import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import https from "https";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { ATTEMPT_TIMEOUT_MS, askWithRetry, isModelBusy, isTimeout, retryPlan } from "./src/lib/modelRetry";
import { emptyBudget, isScannableParish, spentMessage, type ScanBudget } from "./src/lib/scanQuota";
import { readParishContent } from "./src/lib/parishContentStore";
import { codeEmail, messageFor, type OtpFailure } from "./src/lib/adminOtp";
import { issueCode, verifyCode } from "./src/lib/adminOtpStore";
import { groundingBlock, isGap, itemFacts, massFact, type Fact, type Gap } from "./src/lib/sanctiGrounding";
import { MASS_SCHEDULES } from "./src/data";
import {
  initQuotaStore, quotaStoreReady, readBudget, refundScan, spendScan, uidFromToken,
} from "./src/lib/scanQuotaStore";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// getUserMedia (the AR Tour camera) only works in a "secure context" — https,
// or the literal hostname `localhost`. A phone on the church wifi visiting
// http://192.168.x.x:5173 gets `navigator.mediaDevices === undefined` before
// any permission prompt ever shows. HTTPS is how a phone on the LAN gets in.
//
// This is opt-in (HTTPS=1 npm run dev, or `npm run dev:https`) so the default
// `npm run dev` / http://localhost:5173 workflow is unchanged and needs no
// certificate. The cert is self-signed and generated on first run with the
// `selfsigned` package (pure JS, no external binary, no account) — see
// docs/CAMERA-SETUP.md for what the resulting phone warning means.
const USE_HTTPS = process.env.HTTPS === "1" || process.env.HTTPS === "true";
const CERT_DIR = path.join(process.cwd(), ".cert");
const CERT_PATH = path.join(CERT_DIR, "cert.pem");
const KEY_PATH = path.join(CERT_DIR, "key.pem");

async function getOrCreateCert(): Promise<{ key: string; cert: string }> {
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    return { key: fs.readFileSync(KEY_PATH, "utf8"), cert: fs.readFileSync(CERT_PATH, "utf8") };
  }

  // Dynamic import: `selfsigned` is a devDependency, only ever touched when a
  // developer opts into HTTPS locally — a production install must not need it.
  const selfsigned = await import("selfsigned");
  const lanIps = getLanIps();
  const altNames: Array<{ type: 2 | 7; value?: string; ip?: string }> = [
    { type: 2, value: "localhost" }, // DNS
    { type: 7, ip: "127.0.0.1" }, // IP
    ...lanIps.map((ip) => ({ type: 7 as const, ip })),
  ];
  const notAfterDate = new Date();
  notAfterDate.setDate(notAfterDate.getDate() + 825);
  const pems = await selfsigned.generate([{ name: "commonName", value: "localhost" }], {
    notAfterDate,
    keySize: 2048,
    extensions: [{ name: "subjectAltName", altNames }],
  });

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, pems.private);
  fs.writeFileSync(CERT_PATH, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

function getLanIps(): string[] {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

// 12mb, not the 100kb express.json() defaults to.
//
// The camera posts a base64 JPEG, and base64 inflates a payload by about a
// third. At the old default a 640px frame of a plain subject squeaked
// through at 65kb, while the same 640px frame of a *detailed* scene — a
// flower-covered carroza, stained glass, a crowded nave — compressed worse,
// crossed 100kb, and was rejected with a 413 that the dev server answered
// with an HTML error page. The client then failed to parse it as JSON and
// reported "Could not reach the server", so a size limit surfaced as a
// network fault, intermittently, depending on what the camera was pointed at.
// Cross-origin access for the packaged app.
//
// On the web SanctiWalk is served BY this server, so every /api call is
// same-origin and CORS never enters into it. Inside the APK it is not:
// Capacitor serves the bundle from https://localhost and this server is a
// different origin, so the browser demands CORS headers and silently
// refuses the request without them. That is why the scanner failed on the
// phone with the endpoint plainly reachable - the request arrived and the
// WebView threw the answer away.
//
// The same applies to the deployed backend, where the app's origin is
// still https://localhost, so this is not tunnel-specific plumbing.
//
// The allowlist is the app's own origins plus localhost and private-LAN
// dev servers. It is not `*`, because these endpoints spend a real Gemini
// quota and the APP_KEY header is what stands between them and anyone who
// finds the URL; a wildcard would let any web page in the world use a
// key lifted from the bundle.
const APP_ORIGINS = new Set([
  "https://localhost",      // Capacitor, Android
  "capacitor://localhost",  // Capacitor, iOS
  "http://localhost",
  // The deployed web app and the parish office portal.
  //
  // Missing until the office tried to sign in and the browser refused
  // the request before sending it - which surfaced as "could not
  // reach the server" while the server sat there answering /api/health
  // in under a second. Everything API-backed had quietly only ever
  // worked from the APK, whose origin is https://localhost.
  "https://sanct-demo-vxzb.vercel.app",
]);

const isAllowedOrigin = (origin: string) =>
  APP_ORIGINS.has(origin) ||
  /^https?:\/\/localhost:\d+$/.test(origin) ||
  /^https?:\/\/(?:192\.168|10)\.\d{1,3}\.\d{1,3}(?::\d+)?$/.test(origin);

app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  if (typeof origin === "string" && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    // Authorization belongs here because every scan now carries a
    // Firebase ID token. Leaving it out does not fail loudly: the
    // preflight is refused, the browser discards a response the server
    // happily produced, and the app reports "could not reach the
    // server" for a request the log shows arriving and being answered.
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-SanctiWalk-Key");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  // Preflight needs an answer before any body parsing or auth.
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "12mb" }));

// Lazy-initialize Gemini API
/**
 * Recognition is capped per day.
 *
 * Counted here rather than in the browser because what is actually scarce is
 * the free-tier allowance on the single API key this server holds — shared by
 * every device using the app. A per-device counter in localStorage would both
 * over- and under-report, and anyone could clear it.
 *
 * In memory, deliberately: a server restart resets the count. That is the
 * right trade for a capstone demo, and it is stated rather than pretended
 * otherwise.
 */
/**
 * The vision model used for camera recognition.
 *
 * Measured on the same 24KB frame, all returning the same correct
 * identification with the full summary and highlights:
 *
 *   gemini-3.5-flash      + LOW thinking      20.7s
 *   gemini-3.5-flash      + MINIMAL thinking  13.7s
 *   gemini-3.5-flash-lite + MINIMAL thinking   1.5-1.9s
 *
 * A scanner that takes twenty seconds is not a scanner, so flash-lite is the
 * default. It is a smaller model, so if a particular statue or retablo is
 * being misidentified, GEMINI_VISION_MODEL=gemini-3.5-flash in .env switches
 * back and trades the speed for the larger model's judgement.
 *
 * The two models also hold separate free-tier quotas, which is worth knowing
 * when recognition starts refusing: exhausting one does not exhaust the other.
 */
const VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash-lite";

/**
 * Where recognition goes when the primary model is congested.
 *
 * Deliberately NOT another "-lite": a 503 means that model's serving pool is
 * saturated, so retrying inside the same pool is the one thing guaranteed not
 * to help. The two models also hold separate free-tier quotas (see above), so
 * falling back neither borrows nor exhausts the primary's allowance.
 */
const VISION_MODEL_FALLBACK = process.env.GEMINI_VISION_MODEL_FALLBACK || "gemini-3.5-flash";

/**
 * Shared key the app sends on every /api call.
 *
 * Enforced ONLY when APP_KEY is set in this server's environment, so local
 * development needs no configuration and nothing that works today breaks.
 * Set it on the deployed host, where the URL is public and /api/identify
 * spends a real Gemini quota.
 *
 * This is a speed bump, not authentication: the key ships inside the app and
 * can be extracted from the APK. It stops bots and passers-by, which is the
 * realistic threat. The per-IP cap below bounds what one determined person
 * can spend.
 */
const APP_KEY = process.env.APP_KEY || "";
const APP_KEY_HEADER = "x-sanctiwalk-key";

function requireAppKey(req: express.Request, res: express.Response): boolean {
  if (!APP_KEY) return true;

  const provided = req.get(APP_KEY_HEADER);
  if (provided === APP_KEY) return true;

  console.warn(`[Auth] rejected ${req.method} ${req.path} from ${clientIp(req)} - bad or missing key`);
  res.status(401).json({ error: "This build is not authorised to use the SanctiWalk service." });
  return false;
}

/**
 * The daily allowance, per signed-in user and per parish.
 *
 * This used to count against the caller's IP address, which is not a
 * person. Everyone on a church's Wi-Fi shared one address and therefore
 * one allowance, so the first visitor through the door could spend the
 * whole room's; step outside onto mobile data and you became somebody
 * new with a fresh twenty. Both halves were wrong.
 *
 * It is counted against the Firebase account now, in Firestore, with
 * the read and the write in one transaction so two requests racing
 * cannot both be told they were the last one. The rules themselves live
 * in src/lib/scanQuota.ts, which the app imports too, so what the
 * screen promises and what the server enforces cannot drift apart.
 *
 * The consequence for a visitor is real and worth stating: scanning now
 * requires signing in. Everything else in SanctiWalk still works
 * signed-out.
 */
function clientIp(req: express.Request): string {
  // Render puts the real address in x-forwarded-for; req.ip would be the
  // load balancer. Only used for logging now.
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.ip || "unknown";
}

/**
 * Lets a developer run the scanner with no Firebase credentials.
 *
 * Off unless asked for, and refused outright in production so it can
 * never be the thing that makes a deployed server unlimited. Even when
 * on, the backstop below keeps a hard per-IP ceiling, because "my
 * laptop" and "reachable from the internet" are not always as different
 * as the person running it believes.
 */
const UNCOUNTED_OK =
  process.env.ALLOW_UNCOUNTED_SCANS === "1" && process.env.NODE_ENV !== "production";

const DEV_BACKSTOP_LIMIT = Number(process.env.DEV_SCAN_LIMIT) || 40;
let devBackstopDay = "";
const devBackstopByIp = new Map<string, number>();

function devBackstopAllows(req: express.Request, res: express.Response): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (devBackstopDay !== today) {
    devBackstopDay = today;
    devBackstopByIp.clear();
  }
  const ip = clientIp(req);
  const used = devBackstopByIp.get(ip) ?? 0;
  if (used >= DEV_BACKSTOP_LIMIT) {
    res.status(429).json({
      error: "This development server's scan ceiling is spent. Restart it, or configure Firebase.",
      code: "daily_limit",
    });
    return false;
  }
  devBackstopByIp.set(ip, used + 1);
  return true;
}

/**
 * The signed-in user behind a request, or null after answering 401.
 *
 * The uid comes from a token Google's keys verify, never from the body,
 * so a client cannot claim to be somebody else or invent a fresh
 * identity per scan.
 */
async function requireUser(
  req: express.Request,
  res: express.Response,
): Promise<string | null> {
  if (!quotaStoreReady()) {
    // Fail CLOSED. The first version returned a shared "anonymous" uid
    // here, which meant a deploy that simply forgot
    // FIREBASE_SERVICE_ACCOUNT served an unlimited, unauthenticated
    // scanner to anyone who found the URL - and the per-IP cap that
    // used to bound that had just been removed. A missing environment
    // variable is the likeliest mistake of the whole deployment, so it
    // has to be the safe one.
    //
    // Local development opts out explicitly, and production may not:
    // see UNCOUNTED_OK.
    if (!UNCOUNTED_OK) {
      res.status(503).json({
        error: "The scanner is not available right now. Please try again later.",
        code: "quota_unavailable",
      });
      return null;
    }
    if (!devBackstopAllows(req, res)) return null;
    return `dev:${clientIp(req)}`;
  }

  const uid = await uidFromToken(req.get("authorization"));
  if (uid) return uid;

  res.status(401).json({
    error: "Sign in to use the AI scanner. Your daily scans are counted against your account.",
    code: "sign_in_required",
  });
  return null;
}

/** A parish's name, for messages a visitor reads. */
function parishName(parishId: string): string {
  return parishId === "route-src"
    ? "San Roque Cathedral Parish"
    : "Mary Help of Christians Parish";
}

/** The parish a request is for, or null after answering 400. */
function requireParish(req: express.Request, res: express.Response): string | null {
  const parishId = (req.body?.parishId ?? req.query?.parishId) as unknown;
  if (isScannableParish(parishId)) return parishId;

  res.status(400).json({
    error: "The scanner needs to know which parish you are visiting.",
    code: "parish_required",
  });
  return null;
}

/** Open-ended recognition, used when there is no station shortlist. */
const OPEN_INSTRUCTION = [
  "Identify the main subject of this camera frame.",
  "",
  "Name it as specifically as you can — a particular statue, altar, window,",
  "artwork, or building rather than a generic category. Ignore hands and the",
  "person holding the camera. If the frame is too blurry, too dark, or shows",
  "nothing identifiable, set recognized to false.",
  "",
  "Do not invent parish-specific history, dates, donors, or names. If you do",
  "not know, describe what is visible instead.",
  "",
  "If the subject depicts a saint, a blessed, or Our Lady under a title, also",
  "fill saintName and aboutSaint, and - only when you are certain - feastDay",
  "and patronage. Someone standing in front of a statue can already see the",
  "statue; what they cannot see is who it is of. Leave feastDay and patronage",
  "empty rather than guessing.",
].join("\n");

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it to Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Full-stack API Endpoint: Generate Custom Walk Guide with Gemini
app.post("/api/generate-walk", async (req, res) => {
  if (!requireAppKey(req, res)) return;

  try {
    const { interest, location, durationMinutes } = req.body;
    
    if (!interest || !location) {
      return res.status(400).json({ error: "Missing interest or location parameters." });
    }

    const duration = durationMinutes ? parseInt(durationMinutes) : 30;
    const prompt = `Create a custom historic/heritage/spiritual walking tour guide in ${location} based on the user's interest in "${interest}" that lasts roughly ${duration} minutes. Give it an inspiring name, descriptive intro, and exactly 2-3 stops (stations) with detailed historical significance and a personal wellness/reflection question at each stop. Return the data structured in the requested JSON format. Ensure all coordinate-based offsets are logical.`;

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert cultural guide, historian, and wellness walking coach. You design engaging walks that combine history, heritage, and mindfulness.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "An inspiring, elegant name for this walk."
            },
            description: {
              type: Type.STRING,
              description: "A summary of what makes this walk unique and relaxing."
            },
            distanceKm: {
              type: Type.NUMBER,
              description: "Estimated distance in kilometers (e.g. 1.8)."
            },
            durationMins: {
              type: Type.INTEGER,
              description: "Estimated walking time in minutes."
            },
            estimatedSteps: {
              type: Type.INTEGER,
              description: "Estimated steps (e.g. 2400)."
            },
            stations: {
              type: Type.ARRAY,
              description: "The stops on this walking guide.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "Name of the stop/station."
                  },
                  description: {
                    type: Type.STRING,
                    description: "A friendly 1-2 sentence description of what the user sees here."
                  },
                  history: {
                    type: Type.STRING,
                    description: "The historical context, heritage significance, or architectural details of this spot."
                  },
                  reflection: {
                    type: Type.STRING,
                    description: "A mindfulness or spiritual question for the user to contemplate while at this spot."
                  },
                  audioDuration: {
                    type: Type.STRING,
                    description: "Estimated audio guide duration, e.g., '2:30'"
                  }
                },
                required: ["name", "description", "history", "reflection", "audioDuration"]
              }
            }
          },
          required: ["name", "description", "distanceKm", "durationMins", "estimatedSteps", "stations"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from AI.");
    }

    const walkData = JSON.parse(resultText);
    res.json(walkData);
  } catch (error: any) {
    console.error("Gemini Walk Generation failed:", error);
    // Return mock fallback walk data so that it still functions gracefully if key is missing!
    res.json({
      name: `Custom ${req.body.interest || "Peaceful"} Walk`,
      description: `A simulated custom walk created for ${req.body.location || "your location"} focusing on ${req.body.interest || "mindfulness"}. (Note: Connect Gemini API Key to enable real AI generation).`,
      distanceKm: 1.8,
      durationMins: req.body.durationMinutes ? parseInt(req.body.durationMinutes) : 30,
      estimatedSteps: 2500,
      isFallback: true,
      stations: [
        {
          name: "The Garden of Tranquility",
          description: "A peaceful outdoor green space to settle your thoughts.",
          history: "This location represents the timeless tradition of cultivating spaces of retreat and natural beauty amid academic and community settings.",
          reflection: "Close your eyes and listen to three distinct sounds. What are they telling you about the present moment?",
          audioDuration: "1:45"
        },
        {
          name: "The Archway of Legacy",
          description: "A beautiful structural landmark symbolizing transition, passage, and academic milestone achievements.",
          history: "Historically, stone arches have marked the boundaries of cities and learning institutions, commemorating those who passed through to build the future.",
          reflection: "As you walk through boundaries today, what old habits are you leaving behind, and what new paths are you embracing?",
          audioDuration: "2:15"
        }
      ]
    });
  }
});

// Full-stack API Endpoint: Identify what the camera is looking at (AR Tour)
//
// The API key stays on the server — the browser only ever sends an image and
// receives text, so nothing sensitive reaches the client bundle.
//
// `candidates` is the accuracy lever. A vision model is weak at open-ended
// "what specific statue is this", but strong at "which of these five stations
// is this". When the app knows which parish the pilgrim is in, it should send
// that parish's station names and turn recognition into a multiple choice.
app.post("/api/identify", async (req, res) => {
  if (!requireAppKey(req, res)) return;

  const uid = await requireUser(req, res);
  if (!uid) return;
  const parishId = requireParish(req, res);
  if (!parishId) return;

  // Reserved here, before the model is asked. Checking first and
  // charging afterwards lets a client that aborts mid-request scan for
  // ever; the refund below covers the failures that are genuinely ours.
  let spent = false;
  let budget: ScanBudget;

  try {
    const attempt = quotaStoreReady()
      ? await spendScan(uid, parishId)
      // The development path, and only reachable through it, because
      // requireUser has already answered 503 for everybody else. There
      // is no store to count in, so the per-IP ceiling it already
      // charged is what bounds this.
      : { allowed: true, budget: emptyBudget(parishId) };

    budget = attempt.budget;
    if (!attempt.allowed) {
      return res.status(429).json({
        error: spentMessage(parishName(parishId)),
        code: "daily_limit",
        budget,
      });
    }
    spent = quotaStoreReady();
  } catch (err) {
    console.error("[Quota] could not reserve a scan:", (err as Error).message);
    return res.status(503).json({
      error: "The scanner could not check your remaining scans. Please try again.",
      code: "quota_unavailable",
    });
  }

  try {
    const { imageBase64, mimeType, candidates } = req.body ?? {};

    if (typeof imageBase64 !== "string" || imageBase64.length < 512) {
      console.error(
        `[Scanner] Scanner error: rejected payload — imageBase64 was ${
          typeof imageBase64 === "string" ? `${imageBase64.length} chars` : typeof imageBase64
        }`,
      );
      return res.status(400).json({
        error: "The captured image did not arrive properly. Please try scanning again.",
      });
    }

    // Base64 is 4 chars per 3 bytes, so this is the decoded size.
    const imageBytes = Math.round(imageBase64.length * 0.75);
    console.log(`[Scanner] API request: ${(imageBytes / 1024).toFixed(0)} KB image, model ${VISION_MODEL}`);

    const shortlist: string[] = Array.isArray(candidates) ? candidates.filter(Boolean) : [];

    const instruction = shortlist.length
      ? [
          "You are identifying a feature inside a specific Catholic parish church.",
          "",
          "The pilgrim is at a station that is one of the following:",
          ...shortlist.map((name: string) => `- ${name}`),
          "",
          "Look carefully at the whole frame before answering.",
          "",
          "If the photo shows one of them, name that station and set",
          "matchedStation to true. The list is the strongest evidence you",
          "have about what this object is, so prefer a listed station over a",
          "guess when the image is consistent with it.",
          "",
          "If it shows none of them, DO NOT set recognized to false. Identify the",
          "subject anyway — as specifically as you can — and set matchedStation to",
          "false. A pilgrim pointing a camera at something outside the tour still",
          "deserves an answer.",
          "",
          "Set recognized to false only when the frame is too blurry or dark, or",
          "shows nothing identifiable at all.",
          "",
          "In `summary`, say what you actually saw that led to the answer, so",
          "the pilgrim can check it against what is in front of them. Set",
          "`confidence` honestly, and when the frame is unusable put a short",
          "practical instruction in `advice`.",
          "",
          "Only state facts you can see in the image or that are common knowledge",
          "about the subject. Do not invent parish-specific history, dates, donors,",
          "or names — if you do not know, say what is visible instead.",
          "",
          "If the subject depicts a saint, a blessed, or Our Lady under a title,",
          "also fill saintName, aboutSaint, and - only when you are certain -",
          "feastDay and patronage. `summary` explains what you saw; `aboutSaint`",
          "says who they were. Someone standing in front of a statue can already",
          "see the statue, so a description of it teaches them nothing. Leave",
          "feastDay and patronage empty rather than guessing: a wrong feast day",
          "sends somebody to church on the wrong morning.",
        ].join("\n")
      : OPEN_INSTRUCTION;

    const ai = getAi();
    const askModel = (prompt: string, model: string = VISION_MODEL, timeoutMs: number = ATTEMPT_TIMEOUT_MS) => ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: {
        // Bounds a single attempt. Without it a call that is accepted and
        // then never answered — observed running past two minutes against
        // this very endpoint — holds the request open indefinitely.
        abortSignal: AbortSignal.timeout(timeoutMs),
        // Recognition is perception, not deliberation. MINIMAL, not LOW:
        // measured on the same frame, LOW spent 275 thinking tokens and 7
        // extra seconds to reach the identical answer. Note that omitting
        // thinkingConfig entirely does NOT disable thinking — it re-enables
        // it at the model's own default, which measured worse than MINIMAL.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recognized: {
              type: Type.BOOLEAN,
              description: "False when the frame shows nothing identifiable.",
            },
            title: {
              type: Type.STRING,
              // This field's own description used to read "the subject's
              // specific name", which pulled against the instruction above
              // and kept producing confident wrong devotions — a schema
              // description is an instruction to the model too.
              description:
                "What the subject is. Use a specific saint or devotion ONLY when the image shows attributes that distinguish it (an inscription, name plate, or unique emblem). Otherwise use an accurate general description such as 'Crowned Marian image with the Child Jesus'. Empty when not recognized.",
            },
            category: { type: Type.STRING, description: "Short type label: Statue, Altar, Window, Painting, Relic, Architecture." },
            confidence: {
              type: Type.NUMBER,
              description:
                "0 to 1. Be honest. Use 0.9+ only when an inscription or unique emblem confirms the identification; use 0.4-0.6 for a general category recognised without distinguishing marks.",
            },
            summary: {
              type: Type.STRING,
              description:
                "2-4 sentences for someone standing in front of it. Begin by naming the visual evidence you used — the crown, vestment colour, emblem, inscription — then what it is. Say plainly if you are unsure.",
            },
            highlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Three short standalone facts.",
            },
            advice: {
              type: Type.STRING,
              description:
                "When recognized is false: one short, practical instruction for the pilgrim, e.g. move closer or improve the lighting. Empty otherwise.",
            },
            matchedStation: {
              type: Type.BOOLEAN,
              description:
                "True when the subject is one of the listed stations. False when it was identified but is not on the list. Ignored when no list was given.",
            },
            saintName: {
              type: Type.STRING,
              description:
                "When the subject depicts a saint, blessed, or Our Lady under a title, their full common English name, e.g. 'Saint Francis of Assisi' or 'Our Lady of Perpetual Help'. Empty string when the subject is not a holy figure.",
            },
            feastDay: {
              type: Type.STRING,
              description:
                "That saint's feast day in the Roman calendar, e.g. 'October 4'. Leave EMPTY if you are not certain - a wrong feast day sends someone to church on the wrong morning. Never guess.",
            },
            patronage: {
              type: Type.STRING,
              description:
                "What they are the patron of, in a few words, e.g. 'animals, ecology and merchants'. Leave EMPTY if unsure. Never guess.",
            },
            aboutSaint: {
              type: Type.STRING,
              description:
                "3-5 sentences on who this saint actually was and why they are venerated: when and where they lived, what they are known for, and what their usual emblems mean. This is general Catholic knowledge about the person, NOT a description of the object in the photo - the pilgrim can already see the object. Write it in your own words. Empty string when the subject is not a holy figure.",
            },
          },
          required: ["recognized", "title", "category", "confidence", "summary", "highlights"],
        },
      },
    });

    const startedAt = Date.now();
    // Retry sequencing lives in src/lib/modelRetry.ts, where it is unit
    // tested — the behaviour that matters (three tries, then a different
    // model, and NO retry for a bad key or a spent quota) is not something
    // to verify by re-reading.
    const { value: response, model: answeringModel, attempt } = await askWithRetry(
      retryPlan(VISION_MODEL, VISION_MODEL_FALLBACK),
      (model, timeoutMs) => askModel(instruction, model, timeoutMs),
      {
        onBusy: (model, n) => console.warn(`[Scanner] ${model} did not answer (attempt ${n}) — retrying`),
      },
    );
    if (attempt > 1) console.log(`[Scanner] Recovered on attempt ${attempt} using ${answeringModel}`);

    // Logged so "the scanner feels slow" can be answered with a number
    // instead of a guess — which is how the 20s-to-1.5s fix was found.
    console.log(`[Scanner] API response: ${answeringModel} answered in ${Date.now() - startedAt}ms`);
    const text = response.text;
    if (!text) {
      return res.status(502).json({ error: "The vision model returned no content." });
    }

    const result = JSON.parse(text);

    // The station shortlist used to instruct the model to answer "none of
    // these" for anything that was not one of the parish's own stations —
    // which is most of what a pilgrim will point a camera at. The identical
    // frame that returned a confident "Our Lady of Grace" with no shortlist
    // returned recognized:false with one, so the scanner looked broken the
    // moment you were standing at a parish.
    //
    // The prompt now asks for both jobs in one pass: match a station if the
    // photo shows one, otherwise identify the subject anyway and say it isn't
    // on the list. A two-call fallback would also have worked, but it spent
    // two of the day's twenty recognitions on every miss.
    if (!shortlist.length) delete result.matchedStation;

    return res.json({ ...result, budget });
  } catch (error: any) {
    const message = String(error?.message ?? error);

    // The free tier allows a small number of requests per model per day. Say so
    // plainly rather than surfacing a raw stack trace to a pilgrim.
    if (message.includes("429") || message.toUpperCase().includes("RESOURCE_EXHAUSTED")) {
      if (spent) await refundScan(uid, parishId);
      return res.status(429).json({
        error: "The recognition service is busy. Please try again in a little while.",
        code: "quota_exhausted",
        budget: await readBudget(uid, parishId),
      });
    }

    // The real error goes to the console; the pilgrim gets something they can
    // act on. An API key problem in particular is a configuration fault, not
    // something a pilgrim can fix by trying again, so it says so.
    console.error("[Scanner] Scanner error:", message);

    // Everything below is the server, the key or the model failing - none
    // of it is the visitor's doing, so they get the scan back. A
    // photograph the model simply could not name is NOT refunded: that is
    // a real recognition, and refunding it would make the allowance
    // unlimited for anyone pointing the camera at a wall.
    if (spent) await refundScan(uid, parishId);

    if (/API key|API_KEY|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
      return res.status(500).json({
        error: "Recognition is not configured on the server. Check GEMINI_API_KEY.",
        code: "auth",
      });
    }
    if (/deadline|timeout|ETIMEDOUT|ECONNRESET|fetch failed|ENOTFOUND/i.test(message)) {
      return res.status(504).json({
        error: "Recognition timed out. Check your connection and try again.",
        code: "timeout",
      });
    }
    // Congestion, after every retry and the fallback model have been tried.
    // It gets its own code and its own words because the remedy — wait a
    // moment, tap again — is completely different from "your photo was bad",
    // which is what the generic message below implies.
    if (isModelBusy(message) || isTimeout(message)) {
      return res.status(503).json({
        error:
          "The recognition service is busy right now. This is on their side, not yours — wait a few seconds and tap scan again.",
        code: "model_busy",
      });
    }

    return res.status(500).json({ error: "Recognition failed. Please try again." });
  }
});

// Is this server up? Nothing more.
//
// The host's health check has to reach this without a key: it is an
// anonymous GET from the platform, and a check that 401s reads as a dead
// service - the deploy is then held back and never goes live. render.yaml
// used to point at /api/identify/budget, which is key-guarded, so setting
// APP_KEY would have failed every deploy from then on.
//
// It answers only "yes", with no quota, version or configuration in it, so
// there is nothing here worth guarding.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * Ask Sancti, grounded in the parish's own records.
 *
 * ## Why the model never answers alone
 *
 * A language model asked "what time is Mass at San Roque" will answer.
 * It will produce a time, in the right format, with no sign that it was
 * invented - which for the one question a pilgrim acts on by leaving
 * the house at a particular hour is the worst possible failure. So the
 * model is never the source of a fact here. Every parish fact is read
 * from Firestore first, handed over as a VERIFIED FACTS block, and the
 * model's only job is to put it into a sentence in the pilgrim's own
 * language.
 *
 * Gaps are passed in as explicitly as facts. A model given only facts
 * fills a silence, and what it fills it with is a plausible Mass time;
 * told in writing that the schedule is not published, saying so becomes
 * the expected answer rather than a failure to answer.
 *
 * ## Why failure is a clean 503
 *
 * The client keeps its on-device matcher and falls back to it whenever
 * this endpoint cannot help. An assistant whose first act is to fail at
 * a dead URL is worse than no assistant, which is the reason Sancti was
 * built on-device in the first place; that guarantee is kept by saying
 * so clearly rather than by returning something invented.
 */
const ASK_SYSTEM_INSTRUCTION = [
  "You are Sancti, a warm and respectful guide inside the SanctiWalk app for the Diocese of Kalookan.",
  "",
  "ABSOLUTE RULES:",
  "1. Parish facts - Mass times, schedules, requirements, contact details, fees, policies, events - may ONLY come from the VERIFIED FACTS block. Never infer, estimate or recall them.",
  "2. If something is listed under NOT AVAILABLE, say plainly that it is not published in the app and suggest contacting the parish office. Never fill the gap.",
  "3. If a fact is marked as SanctiWalk app data rather than the parish office, say it is the app's information and may not be the parish's latest.",
  "4. If a parish fact is old, mention when the parish last updated it.",
  "5. General Catholic teaching, prayers, the Rosary, the meaning of sacraments and traditions you may answer from your own knowledge - but label it as general Catholic guidance, kept separate from this parish's own information.",
  "6. Never invent a parish's history, a saint's connection to it, a phone number, a price, or an event date.",
  "7. Never claim a parish offers a service unless the VERIFIED FACTS say so.",
  "8. Never mention buttons, screens or features that were not named in the context you were given.",
  "",
  "STYLE: answer the question first, in two or three sentences, then any useful detail. Reply in the language the user wrote in - English or Filipino. Warm, plain, never preachy.",
].join("\n");

app.post("/api/ask", async (req, res) => {
  if (!requireAppKey(req, res)) return;

  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question) return res.status(400).json({ error: "Missing question." });
  // A guard, not a limit on curiosity: the grounding block and the
  // recent conversation share a context window with it.
  if (question.length > 600) return res.status(400).json({ error: "Question is too long." });

  const parishId = typeof req.body?.parishId === "string" ? req.body.parishId : "";
  const parishName =
    typeof req.body?.parishName === "string" && req.body.parishName.trim()
      ? req.body.parishName.trim()
      : "this parish";

  try {
    const ai = getAi();

    // Retrieval first. Everything the answer may assert is gathered
    // here, from the parish's own document where it has one.
    const content = parishId ? await readParishContent(parishId) : null;
    const facts: Fact[] = [];
    const gaps: Gap[] = [];

    if (parishId) {
      const mass = massFact(content, MASS_SCHEDULES[parishId]?.schedule);
      if (isGap(mass)) gaps.push(mass); else facts.push(mass);

      if (content?.description?.trim()) {
        facts.push({ topic: "description", value: content.description.trim(), source: "parish", updatedAt: content.updatedAt });
      }
      if (content?.historyBody?.trim()) {
        facts.push({ topic: "history", value: content.historyBody.trim(), source: "parish", updatedAt: content.updatedAt });
      } else {
        gaps.push({ topic: "history", reason: "This parish has not published its history in the app." });
      }

      // Only the sacraments and ministries the question actually reaches
      // for. Sending all of them would crowd the window and bury the one
      // fact the pilgrim asked about.
      const asked = question.toLowerCase();
      const TOPICS: Array<[string, string, string[]]> = [
        ["sac-baptism", "Baptism", ["bapti", "binyag", "christen"]],
        ["sac-wedding", "Wedding", ["wedding", "marriage", "kasal", "ikakasal"]],
        ["sac-confirmation", "Confirmation", ["confirmation", "kumpil"]],
        ["sac-eucharist", "Holy Communion", ["communion", "eucharist", "komunyon"]],
        ["min-choir", "Choir", ["choir", "koro", "sing"]],
        ["min-altar-servers", "Altar Servers", ["altar server", "sakristan", "acolyte"]],
      ];
      for (const [id, label, words] of TOPICS) {
        if (!words.some(w => asked.includes(w))) continue;
        const { facts: f, gaps: g } = itemFacts(content, id, label);
        facts.push(...f);
        gaps.push(...g);
      }
    }

    const context = parishId
      ? groundingBlock({ parishId, parishName, facts, gaps })
      : [
          "NO PARISH SELECTED.",
          "You have no verified parish information for this question.",
          "If the question needs parish-specific facts, ask which parish they mean instead of guessing.",
        ].join("\n");

    // Recent turns only, and only as plain text, so the model can
    // resolve "what about tomorrow" without the whole session.
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
    const transcript = history
      .filter((m: unknown) => typeof (m as { text?: unknown })?.text === "string")
      .map((m: { role?: string; text: string }) => (m.role === "sancti" ? "Sancti: " : "User: ") + m.text)
      .join("\n");

    const prompt = [
      context,
      transcript ? "\nRECENT CONVERSATION:\n" + transcript : "",
      "\nUSER QUESTION: " + question,
    ].join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { systemInstruction: ASK_SYSTEM_INSTRUCTION, temperature: 0.2 },
    });

    const answer = (response.text ?? "").trim();
    if (!answer) return res.status(502).json({ error: "The assistant did not answer." });

    res.json({
      answer,
      grounded: facts.length > 0,
      // So the UI can say where this came from without re-deriving it.
      sources: facts.map(f => ({ topic: f.topic, source: f.source, updatedAt: f.updatedAt ?? null })),
      gaps: gaps.map(g => g.topic),
    });
  } catch (err) {
    // Never a fabricated fallback answer: the client has a real
    // on-device assistant to fall back to, and it is better than a
    // guess dressed up as a reply.
    console.warn("[Sancti] ask failed:", (err as Error).message);
    res.status(503).json({ error: "The assistant is unavailable." });
  }
});

// Lets the scanner show what is left before anyone spends one. Guarded:
// how much Gemini quota is left is nobody else's business.
app.get("/api/identify/budget", async (req, res) => {
  if (!requireAppKey(req, res)) return;
  const uid = await requireUser(req, res);
  if (!uid) return;
  const parishId = requireParish(req, res);
  if (!parishId) return;
  res.json(await readBudget(uid, parishId));
});

// Check if SMTP is configured for real email sending
/**
 * The parish office's second factor: a six-digit code by email.
 *
 * ## Why the server does this and not the browser
 *
 * The code is generated here, stored here as a hash, and compared
 * here. A browser that generated or checked its own code would be
 * asking itself for permission. The portal only ever learns whether
 * the answer was right.
 *
 * ## Why a custom claim rather than a flag
 *
 * On success the account gets an `admin2fa` custom claim. That lives
 * inside the signed ID token, so it cannot be forged by a client the
 * way a field in a document or a value in localStorage could. The
 * portal refreshes its token and reads it back.
 *
 * Both routes need a valid ID token, so an unauthenticated caller
 * cannot post codes to somebody else's address or grind guesses
 * against their account.
 */
app.post("/api/admin/2fa/request", async (req, res) => {
  if (!requireAppKey(req, res)) return;

  const uid = await uidFromToken(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "Sign in first." });

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    // Said plainly rather than as a silent failure: without mail there
    // is no way to finish signing in, and the administrator needs to
    // know it is the server's fault and not their password.
    return res.status(503).json({
      error: "EMAIL_NOT_CONFIGURED",
      message: "Email is not set up on the server, so a code cannot be sent. " +
               "Contact the SanctiWalk administrator.",
    });
  }

  try {
    const issued = await issueCode(uid);
    if (!issued.ok) {
      return res.status(429).json({
        error: "TOO_SOON",
        message: "A code was just sent. Check your email, or wait a moment and try again.",
        retryAfterMs: issued.retryAfterMs ?? 60_000,
      });
    }

    const { email, parishName } = await adminEmailFor(uid);
    if (!email) return res.status(400).json({ error: "That account has no email address." });

    const mail = codeEmail(issued.code!, parishName);
    await sendMailWithFallback(email, mail.subject, mail.body);

    // The address is NOT returned in full. The portal shows it so the
    // person knows where to look, and a partial is enough for that
    // without putting the whole address on screen.
    return res.json({ ok: true, sentTo: maskEmail(email) });
  } catch (error) {
    console.error("[2FA] could not send a code:", (error as Error).message);
    return res.status(500).json({ error: "That code could not be sent. Try again." });
  }
});

app.post("/api/admin/2fa/verify", async (req, res) => {
  if (!requireAppKey(req, res)) return;

  const uid = await uidFromToken(req.headers.authorization);
  if (!uid) return res.status(401).json({ error: "Sign in first." });

  const code = String(req.body?.code ?? "").trim();
  try {
    const result = await verifyCode(uid, code);
    if (!result.ok) {
      return res.status(400).json({
        error: "BAD_CODE",
        message: messageFor((result.reason ?? "wrong") as OtpFailure),
      });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("[2FA] verify failed:", (error as Error).message);
    return res.status(500).json({ error: "That could not be checked. Try again." });
  }
});

/** "ad****@gmail.com" - enough to recognise, not enough to publish. */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "your email";
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/** The administrator's address and the parish they belong to. */
async function adminEmailFor(uid: string): Promise<{ email: string; parishName: string }> {
  const { getAuth } = await import("firebase-admin/auth");
  const user = await getAuth().getUser(uid);
  const content = await readParishContent(
    (user.customClaims?.churchId as string) ?? "").catch(() => null);
  return {
    email: user.email ?? "",
    parishName: content?.name ?? "SanctiWalk",
  };
}

/**
 * Sends over HTTPS, which is the only way mail leaves this host.
 *
 * Render blocks outbound SMTP on 587 and 25, and on 465 as well -
 * every port nodemailer can use times out. That is not a
 * misconfiguration to work around; it is the platform, and no SMTP
 * setting will change it. An HTTP email API goes out over 443 like
 * any other request.
 *
 * Used when RESEND_API_KEY is set, which is also the switch that
 * makes the parish office's second factor usable again. Without it
 * this falls through to SMTP below, which still works anywhere that
 * does not block the ports - a laptop, or a different host.
 */
async function sendViaResend(to: string, subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");

  // A verified sender is required. Until a parish domain is verified,
  // Resend's own onboarding address works and can only send to the
  // account holder - enough to prove the path and to run the office's
  // own sign-in codes.
  const from = process.env.RESEND_FROM || "SanctiWalk <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
      html: body.replace(/\n/g, "<br/>"),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend refused the message (${res.status}): ${detail.slice(0, 200)}`);
  }
}

/**
 * Sends, trying the implicit-TLS port when the submission port hangs.
 *
 * Render's network blocks outbound connections on 587 and 25, so a
 * mail that looks perfectly configured simply times out - which is
 * exactly what happened here, and it is indistinguishable from a bad
 * password until you watch the connection. 465 carries the same
 * traffic under TLS from the first byte and is usually left open.
 *
 * Tried in order rather than guessed, so a host where 587 works is
 * unaffected and one where it is blocked still gets its mail.
 */
async function sendMailWithFallback(to: string, subject: string, body: string): Promise<void> {
  // HTTPS first where it is available, because on this host it is the
  // only thing that works at all.
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(to, subject, body);
    return;
  }

  const configured = parseInt(process.env.SMTP_PORT || "587");
  const ports = configured === 465 ? [465] : [configured, 465];

  let lastError: Error | null = null;
  for (const port of ports) {
    try {
      await sendMailOn(port, to, subject, body);
      if (port !== configured) {
        console.log(`[mail] port ${configured} did not connect; sent on ${port} instead.`);
      }
      return;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[mail] port ${port} failed: ${lastError.message}`);
    }
  }
  throw lastError ?? new Error("Mail could not be sent.");
}

/** One place that actually sends, shared with /api/send-email. */
async function sendMailOn(port: number, to: string, subject: string, body: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    // A blocked port otherwise hangs for the platform's default,
    // which is long enough that the caller gives up first and the
    // real reason never reaches the log.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    // STARTTLS is required, and the certificate is checked.
    //
    // This connection carries sign-in codes. rejectUnauthorized:false
    // was copied in from the older endpoint below without thinking:
    // it tells Node to accept ANY certificate, so anyone able to sit
    // between this server and the mail host could read the codes in
    // transit and hold the second factor of every parish account.
    //
    // A private mail server with its own CA should pass that CA here
    // rather than turning the check off.
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: `"${process.env.SMTP_SENDER_NAME || "SanctiWalk Parish Office"}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, "<br/>"),
  });
}

app.get("/api/smtp-status", (req, res) => {
  const isConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  res.json({
    isConfigured,
    user: process.env.SMTP_USER || null,
    senderName: process.env.SMTP_SENDER_NAME || "Mary Help of Christians Parish Office"
  });
});

// Send real email via SMTP
app.post("/api/send-email", async (req, res) => {
  if (!requireAppKey(req, res)) return;

  try {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing 'to', 'subject', or 'body' parameter." });
    }

    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const senderName = process.env.SMTP_SENDER_NAME || "Mary Help of Christians Parish Office";

    if (!smtpUser || !smtpPass) {
      return res.status(400).json({
        error: "SMTP_NOT_CONFIGURED",
        message: "SMTP user and password are not configured in environment secrets."
      });
    }

    // The shared sender, so this path gets the same port fallback as
    // the sign-in codes - and so it can be used to prove whether mail
    // leaves this host at all.
    await sendMailWithFallback(to, subject, body);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Failed to send email via SMTP:", error);
    res.status(500).json({ error: "SMTP_ERROR", message: error.message });
  }
});

// Setup Vite Dev Server / Static Asset Serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Unconditional, and at real startup rather than inside the local
  // HTTPS helper where the first version of this hid - on Render that
  // helper never runs, so the store was never initialised and every
  // request would have taken the unavailable path.
  if (initQuotaStore()) {
    console.log("[Quota] Firebase Admin ready — scans counted per user, per parish");
  } else if (UNCOUNTED_OK) {
    console.warn(
      `[Quota] No Firebase credentials. ALLOW_UNCOUNTED_SCANS is on, so scanning works `
      + `with a ${DEV_BACKSTOP_LIMIT}/day per-IP ceiling. Never do this in production.`,
    );
  } else {
    console.error(
      "[Quota] FIREBASE_SERVICE_ACCOUNT is not set — the scanner will answer 503. "
      + "Set it on the host, or set ALLOW_UNCOUNTED_SCANS=1 for local development.",
    );
  }

  const lanIps = getLanIps();

  if (USE_HTTPS) {
    const { key, cert } = await getOrCreateCert();
    https.createServer({ key, cert }, app).listen(PORT, "0.0.0.0", () => {
      console.log(`SanctiWalk Server running on https://localhost:${PORT}`);
      for (const ip of lanIps) {
        console.log(`  On your phone (same wifi): https://${ip}:${PORT}`);
      }
      console.log(
        "  Self-signed certificate — the phone will show a security warning once. " +
          "That is expected; see docs/CAMERA-SETUP.md.",
      );
    });
  } else {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`SanctiWalk Server running on http://localhost:${PORT}`);
      for (const ip of lanIps) {
        console.log(`  On your LAN: http://${ip}:${PORT} (camera will NOT work here — no HTTPS)`);
      }
      console.log("  For a working phone camera, run: npm run dev:https");
    });
  }
}

start();

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import https from "https";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

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

app.use(express.json());

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
const DAILY_SCAN_LIMIT = 20;
let scanDay = "";
let scansUsed = 0;

function scanBudget(): { limit: number; used: number; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  if (scanDay !== today) {
    scanDay = today;
    scansUsed = 0;
  }
  return { limit: DAILY_SCAN_LIMIT, used: scansUsed, remaining: Math.max(0, DAILY_SCAN_LIMIT - scansUsed) };
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
  try {
    const { imageBase64, mimeType, candidates } = req.body ?? {};

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64." });
    }

    const budget = scanBudget();
    if (budget.remaining <= 0) {
      return res.status(429).json({
        error: `All ${budget.limit} recognitions for today have been used. The counter resets tomorrow.`,
        code: "daily_limit",
        budget,
      });
    }

    const shortlist: string[] = Array.isArray(candidates) ? candidates.filter(Boolean) : [];

    const instruction = shortlist.length
      ? [
          "You are identifying a feature inside a specific Catholic parish church.",
          "",
          "The pilgrim is at a station that is one of the following:",
          ...shortlist.map((name: string) => `- ${name}`),
          "",
          "If the photo shows one of them, name that station and set",
          "matchedStation to true.",
          "",
          "If it shows none of them, DO NOT set recognized to false. Identify the",
          "subject anyway — as specifically as you can — and set matchedStation to",
          "false. A pilgrim pointing a camera at something outside the tour still",
          "deserves an answer.",
          "",
          "Set recognized to false only when the frame is too blurry or dark, or",
          "shows nothing identifiable at all.",
          "",
          "Only state facts you can see in the image or that are common knowledge",
          "about the subject. Do not invent parish-specific history, dates, donors,",
          "or names — if you do not know, say what is visible instead.",
        ].join("\n")
      : OPEN_INSTRUCTION;

    const ai = getAi();
    const askModel = (prompt: string) => ai.models.generateContent({
      model: "gemini-3.5-flash",
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
        // Recognition is perception, not deliberation. Left on, thinking accounts
        // for most of the latency and most of the tokens.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recognized: {
              type: Type.BOOLEAN,
              description: "False when the frame shows nothing identifiable.",
            },
            title: { type: Type.STRING, description: "The subject's specific name. Empty when not recognized." },
            category: { type: Type.STRING, description: "Short type label: Statue, Altar, Window, Painting, Relic, Architecture." },
            confidence: { type: Type.NUMBER, description: "0 to 1. Be honest; a low number is more useful than a confident guess." },
            summary: { type: Type.STRING, description: "2-4 sentences for someone standing in front of it." },
            highlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Three short standalone facts.",
            },
            matchedStation: {
              type: Type.BOOLEAN,
              description:
                "True when the subject is one of the listed stations. False when it was identified but is not on the list. Ignored when no list was given.",
            },
          },
          required: ["recognized", "title", "category", "confidence", "summary", "highlights"],
        },
      },
    });

    scansUsed++;
    const response = await askModel(instruction);
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

    return res.json({ ...result, budget: scanBudget() });
  } catch (error: any) {
    const message = String(error?.message ?? error);

    // The free tier allows a small number of requests per model per day. Say so
    // plainly rather than surfacing a raw stack trace to a pilgrim.
    if (message.includes("429") || message.toUpperCase().includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({
        error: "Daily recognition limit reached. Please try again tomorrow.",
        code: "quota_exhausted",
        budget: scanBudget(),
      });
    }

    console.error("[/api/identify]", message);
    return res.status(500).json({ error: "Recognition failed. Please try again." });
  }
});

// Lets the scanner show what is left before anyone spends one.
app.get("/api/identify/budget", (_req, res) => res.json(scanBudget()));

// Check if SMTP is configured for real email sending
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

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"${senderName}" <${smtpUser}>`,
      to,
      subject,
      text: body,
      html: body.replace(/\n/g, "<br/>")
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully: %s", info.messageId);

    res.json({ success: true, messageId: info.messageId });
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

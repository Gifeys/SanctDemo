import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini API
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SanctiWalk Server running on http://0.0.0.0:${PORT}`);
  });
}

start();

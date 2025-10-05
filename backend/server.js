import express from "express";
import multer from "multer";
import { createWorker } from "tesseract.js";
import path from "path";
import fs from "fs";
import cors from "cors";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const MURF_API_KEY = process.env.MURF_API_KEY;

// Exit if API key is missing
if (!MURF_API_KEY) {
  console.error("❌ Murf API key missing in .env");
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ------------------ Temporary Endpoint: List Murf Voices ------------------
app.get("/api/murf-voices", async (req, res) => {
  try {
    const response = await axios.get("https://api.murf.ai/v1/speech/voices", {
      headers: {
        "api-key": MURF_API_KEY,
      },
    });
    console.log("Available Murf voices:", response.data);
    res.json(response.data);
  } catch (error) {
    let errorMsg = error.message;
    if (error.response && error.response.data) {
      errorMsg = error.response.data;
    }
    console.error("Error fetching Murf voices:", errorMsg);
    res.status(500).json({ error: errorMsg });
  }
});

// ------------------ OCR Endpoint ------------------
app.post("/api/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const worker = await createWorker();
    const { data } = await worker.recognize(req.file.path);
    await worker.terminate();

    res.json({ text: data.text });
  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ error: err.message || "OCR failed" });
  } finally {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
  }
});

// ------------------ TTS Endpoint ------------------
app.post("/api/tts", async (req, res) => {
  try {

    let { text, voice } = req.body;
    console.log("Incoming req.body for TTS:", req.body);
    if (!text) return res.status(400).json({ error: "Text missing" });
    // Ensure voice is never null, undefined, or empty string
    if (!voice || typeof voice !== "string" || !voice.trim()) {
      voice = "en-UK-hazel";
      console.warn("No or invalid voice provided, using default:", voice);
    }

    const murfPayload = {
      input: text,
      voice_id: voice, // Murf expects 'voice_id' not 'voice'
      output_format: "mp3",
    };
    console.log("Payload sent to Murf:", murfPayload);
    console.log("Murf API key (first 6 chars):", MURF_API_KEY.slice(0, 6));

    const response = await axios({
      method: "post",
      url: "https://api.murf.ai/v1/speech/generate",
      headers: {
        "api-key": MURF_API_KEY,
        "Content-Type": "application/json",
      },
      data: murfPayload,
      responseType: "arraybuffer", // required for audio binary
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(response.data, "binary"));
  } catch (err) {
    console.error("TTS error details:", err.response?.data || err.message);

    // If response is buffer, decode and parse
    if (err.response?.data instanceof Buffer) {
      const decoded = err.response.data.toString("utf-8");
      console.error("Decoded Murf error:", decoded);
      try {
        const parsed = JSON.parse(decoded);
        return res.status(err.response.status || 500).json(parsed);
      } catch {
        return res.status(500).json({ error: "TTS failed (invalid response)" });
      }
    }

    res.status(err.response?.status || 500).json({
      error: err.response?.data || err.message || "TTS failed",
    });
  }
});

// ------------------ Start Server ------------------
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});

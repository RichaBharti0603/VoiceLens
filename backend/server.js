

import express from "express";
import multer from "multer";
import { createWorker } from "tesseract.js";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
const PORT = 5000;

// Enable CORS for frontend requests
app.use(cors());


// Multer setup
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });


// OCR endpoint
app.post("/api/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const worker = await createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const { data } = await worker.recognize(req.file.path);
    await worker.terminate();

    res.json({ text: data.text });
  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ error: err.message || "OCR failed. Check backend logs." });
  } finally {
    // Delete uploaded file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to delete uploaded file:", err);
      });
    }
  }
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));

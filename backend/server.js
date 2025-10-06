import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const MURF_API_KEY = process.env.MURF_API_KEY;
const MURF_ENDPOINT = process.env.MURF_ENDPOINT || "https://api.murf.ai/v1/tts"; // Override in .env for easy testing

// Supported voices - Confirm from hackathon docs
const validVoices = ["en-UK-hazel", "en-IN-priya"];

// Optional: Add project_id support if Murf requires it (pass from frontend if needed)
app.post("/api/tts", async (req, res) => {
  const { text, voice, project_id } = req.body; // Added project_id for potential Murf requirement

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Text is required for TTS." });
  }

  if (!MURF_API_KEY) {
    console.error("❌ MURF_API_KEY is not configured in .env.");
    return res.status(500).json({ error: "MURF_API_KEY not configured." });
  }

  const voiceId = validVoices.includes(voice) ? voice : validVoices[0];

  console.log("Incoming TTS Request:", { text, voice: voiceId, project_id });

  const payload = {
    text: text,  // Or 'input' - swap if docs specify
    voice_id: voiceId,  // Or 'voice'
    output_format: "mp3",  // Or 'format'
    sample_rate: 44100,
    speaking_rate: 1,
    pitch: 0
  };

  // Add project_id if provided (common for Murf projects)
  if (project_id) {
    payload.project_id = project_id;
  }

  console.log("Using endpoint:", MURF_ENDPOINT);
  console.log("Payload sent:", payload);

  // Endpoint Variations - If 404, update MURF_ENDPOINT in .env or uncomment below and restart
  // Examples to try (one at a time):
  // const MURF_ENDPOINT = "https://api.murf.ai/v1/synthesis";
  // const MURF_ENDPOINT = "https://api.murf.ai/v1/generate";
  // const MURF_ENDPOINT = "https://api.murf.ai/v1/audio";
  // const MURF_ENDPOINT = "https://api.murf.ai/v1/speech";
  // const MURF_ENDPOINT = "https://api.murf.ai/v1/voice/synthesize";
  // const MURF_ENDPOINT = "https://api.murf.ai/v1/projects/synthesize"; // If project-based
  // const MURF_ENDPOINT = "https://hackathon.murf.ai/v1/tts"; // If custom hackathon URL

  try {
    const response = await axios.post(
      MURF_ENDPOINT,
      payload,
      {
        headers: {
          Authorization: `Bearer ${MURF_API_KEY}`,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer",
        timeout: 30000
      }
    );

    console.log("✅ Murf TTS audio received successfully");

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": response.data.length
    });
    res.send(response.data);
  } catch (error) {
    let errorData = error.response?.data;
    let status = error.response?.status || 500;
    let message = "Failed to generate TTS audio.";

    if (Buffer.isBuffer(errorData)) {
      try {
        const decoded = errorData.toString("utf8");
        errorData = JSON.parse(decoded);
        console.error("❌ TTS error (decoded):", errorData);
        message = errorData?.errorMessage || errorData?.error || errorData?.message || message;
      } catch (parseErr) {
        console.error("❌ TTS error (raw buffer):", errorData.toString("utf8"));
        message = errorData.toString("utf8") || message;
      }
    } else {
      console.error("❌ TTS error:", errorData || error.message);
      message = errorData?.errorMessage || errorData?.error || errorData?.message || error.message || message;
    }

    console.error("Full error details:", {
      status,
      message,
      endpoint: MURF_ENDPOINT,
      voice: voiceId,
      payloadKeys: Object.keys(payload)
    });

    res.status(status).json({ error: message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    apiKeyLoaded: !!MURF_API_KEY,
    endpoint: MURF_ENDPOINT,
    supportedVoices: validVoices 
  });
});

// Voices endpoint for frontend
app.get("/api/voices", (req, res) => {
  res.json(validVoices.map(voice => ({ voiceId: voice })));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
  console.log("MURF_API_KEY loaded:", MURF_API_KEY ? "Yes" : "No (check .env)");
  console.log("Current endpoint:", MURF_ENDPOINT);
  console.log("Supported voices:", validVoices);
  console.log("Test health: http://localhost:5000/health");
  console.log("Hackathon tip: Update MURF_ENDPOINT in .env and restart to test new paths!");
});
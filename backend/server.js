import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;
const MURF_API_KEY = process.env.MURF_API_KEY;

console.log("🔧 Backend starting...");
console.log("📋 Murf API Key present:", !!MURF_API_KEY);

// Murf API endpoints
const MURF_BASE_URL = "https://api.murf.ai/v1";
const MURF_TTS_ENDPOINT = `${MURF_BASE_URL}/speech/generate`;
const MURF_VOICES_ENDPOINT = `${MURF_BASE_URL}/speech/voices`;

const murfHeaders = {
  "api-key": MURF_API_KEY,
  "Content-Type": "application/json"
};

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    hasApiKey: !!MURF_API_KEY 
  });
});

// Voices endpoint
app.get("/api/voices", async (req, res) => {
  console.log("🎯 /api/voices endpoint called");
  
  try {
    const response = await axios.get(MURF_VOICES_ENDPOINT, {
      headers: murfHeaders,
      timeout: 10000
    });

    console.log("✅ Murf voices API response received");
    
    let voices = [];
    
    if (Array.isArray(response.data)) {
      voices = response.data.map(voice => ({
        id: voice.voiceId || voice.id,
        name: voice.displayName || voice.name || `Voice ${voice.voiceId}`,
        gender: voice.gender || 'unknown',
        language: voice.language || 'en',
        accent: voice.accent || ''
      }));
    } else if (response.data && response.data.voices) {
      voices = response.data.voices.map(voice => ({
        id: voice.voiceId || voice.id,
        name: voice.displayName || voice.name || `Voice ${voice.voiceId}`,
        gender: voice.gender || 'unknown',
        language: voice.language || 'en',
        accent: voice.accent || ''
      }));
    } else if (response.data) {
      voices = Object.values(response.data).flat().filter(item => item.voiceId).map(voice => ({
        id: voice.voiceId,
        name: voice.displayName || `Voice ${voice.voiceId}`,
        gender: voice.gender || 'unknown',
        language: voice.language || 'en',
        accent: voice.accent || ''
      }));
    }
    
    console.log(`🎯 Found ${voices.length} voices from Murf API`);
    res.json(voices);

  } catch (error) {
    console.error("❌ Error fetching voices:", error.message);
    
    const fallbackVoices = [
      { id: "en-UK-hazel", name: "Hazel (UK English)", gender: "female", language: "en", accent: "UK" },
      { id: "en-US-ryan", name: "Ryan (US English)", gender: "male", language: "en", accent: "US" },
    ];
    
    res.json(fallbackVoices);
  }
});

// Enhanced TTS endpoint with better audio handling
app.post("/api/tts", async (req, res) => {
  const { text, voice } = req.body;

  console.log("🎯 Incoming TTS Request:", { text, voice });

  if (!text || !voice) {
    return res.status(400).json({ error: "Text and voice are required" });
  }

  try {
    console.log("🔊 Sending request to Murf TTS API...");
    
    // Use minimal parameters for maximum compatibility
    const requestBody = {
      voiceId: voice,
      text: text,
      format: "MP3"
    };

    const response = await axios.post(
      MURF_TTS_ENDPOINT,
      requestBody,
      {
        responseType: "arraybuffer",
        headers: murfHeaders,
        timeout: 30000
      }
    );

    console.log("✅ Murf TTS success - Audio size:", response.data.byteLength, "bytes");

    // Validate the audio data
    const audioBuffer = Buffer.from(response.data);
    
    // Check if it's a valid MP3 by looking for common MP3 headers
    const isValid = validateMP3(audioBuffer);
    console.log("🔍 MP3 Validation:", isValid ? "✅ Valid" : "❌ Invalid");
    
    if (!isValid) {
      console.warn("⚠️ Audio may not be standard MP3 format");
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": "inline; filename=tts-audio.mp3",
      "Cache-Control": "no-cache"
    });

    res.send(audioBuffer);

  } catch (err) {
    console.error("❌ TTS Error:", err.message);
    res.status(500).json({ error: "TTS failed: " + err.message });
  }
});

// Base64 endpoint with validation
app.post("/api/tts-base64", async (req, res) => {
  const { text, voice } = req.body;

  console.log("🎯 Incoming TTS Request (Base64):", { text, voice });

  try {
    const requestBody = {
      voiceId: voice,
      text: text,
      format: "MP3"
    };

    const response = await axios.post(
      MURF_TTS_ENDPOINT,
      requestBody,
      {
        responseType: "arraybuffer",
        headers: murfHeaders,
        timeout: 30000
      }
    );

    console.log("✅ Murf TTS success - Audio size:", response.data.byteLength, "bytes");

    // Validate audio
    const audioBuffer = Buffer.from(response.data);
    const isValid = validateMP3(audioBuffer);
    console.log("🔍 MP3 Validation:", isValid ? "✅ Valid" : "❌ Invalid");

    // Convert to base64
    const base64Audio = audioBuffer.toString('base64');
    
    res.json({
      audio: base64Audio,
      format: "mp3",
      size: response.data.byteLength,
      isValid: isValid
    });

  } catch (err) {
    console.error("❌ Base64 TTS Error:", err.message);
    res.status(500).json({ error: "TTS failed: " + err.message });
  }
});

// Simple MP3 validation function
function validateMP3(buffer) {
  if (buffer.length < 4) return false;
  
  // Check for common MP3 headers
  const header = buffer.slice(0, 4);
  
  // MP3 files typically start with:
  // - ID3 header (for ID3v2 tags): 0x49 0x44 0x33 (ASCII "ID3")
  // - MPEG frame header: 0xFF 0xFB or 0xFF 0xFA or 0xFF 0xF3, etc.
  
  const firstByte = header[0];
  const secondByte = header[1];
  const thirdByte = header[2];
  
  // Check for ID3 header
  if (firstByte === 0x49 && secondByte === 0x44 && thirdByte === 0x33) {
    return true; // ID3v2 tag present
  }
  
  // Check for MPEG frame sync (starts with 0xFF and has specific patterns)
  if (firstByte === 0xFF && (secondByte & 0xE0) === 0xE0) {
    return true; // MPEG frame header
  }
  
  return false;
}

// New endpoint: Test if audio can be played by returning a known good audio file
app.get("/api/test-audio", (req, res) => {
  // Return a simple, known-working audio file for testing
  const testAudio = Buffer.from([
    0xFF, 0xFB, 0x90, 0x64, 0x00, 0x0F, 0xF0, 0x00, 0x00, 0x69, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00,
    0x0D, 0x20, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01, 0xA4, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x34,
    0x80, 0x00, 0x00, 0x04, 0x4C, 0x41, 0x4D, 0x45, 0x33, 0x2E, 0x31, 0x30, 0x30, 0x55, 0x55, 0x55,
    0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55
  ]);

  res.set({
    "Content-Type": "audio/mpeg",
    "Content-Length": testAudio.length,
    "Content-Disposition": "inline; filename=test-audio.mp3"
  });

  res.send(testAudio);
});

app.listen(PORT, () => console.log(`✅ Backend running at http://localhost:5000`));
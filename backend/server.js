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

// Function to analyze response data
function analyzeResponse(data) {
  const buffer = Buffer.from(data);
  console.log("🔍 Analyzing response data...");
  console.log("📊 Total size:", buffer.length, "bytes");
  
  // Check first bytes to determine format
  const firstBytes = buffer.slice(0, 16);
  const hex = firstBytes.toString('hex');
  const ascii = firstBytes.toString('ascii');
  
  console.log("🔍 First 16 bytes (hex):", hex);
  console.log("🔍 First 16 bytes (ascii):", ascii);
  
  let responseType = 'unknown';
  
  if (hex.startsWith('7b22') || ascii.startsWith('{"') || ascii.startsWith('{')) {
    responseType = 'json';
    console.log("🔍 Response type: JSON");
  } else if (hex.startsWith('494433') || hex.startsWith('fff')) {
    responseType = 'mp3';
    console.log("🔍 Response type: MP3 audio");
  } else if (hex.startsWith('52494646')) {
    responseType = 'wav';
    console.log("🔍 Response type: WAV audio");
  } else {
    responseType = 'binary';
    console.log("🔍 Response type: Binary data (possibly raw audio)");
  }
  
  return { responseType, hex, ascii, buffer };
}

// Function to download audio from URL
async function downloadAudioFromUrl(url) {
  console.log("🔗 Downloading audio from URL:", url);
  
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log("✅ Audio download successful - Size:", response.data.byteLength, "bytes");
    return Buffer.from(response.data);
    
  } catch (error) {
    console.error("❌ Audio download failed:", error.message);
    throw error;
  }
}

// Function to extract audio from Murf's JSON response
async function extractAudioFromMurfJSON(jsonData) {
  console.log("🔄 Extracting audio from Murf JSON response...");
  console.log("📋 Available fields:", Object.keys(jsonData));
  
  // Murf returns audio in different possible ways
  let audioBuffer = null;
  
  // Case 1: audioFile contains a URL (most common)
  if (jsonData.audioFile && typeof jsonData.audioFile === 'string') {
    console.log("📋 Found 'audioFile' field:", jsonData.audioFile.substring(0, 100) + "...");
    
    if (jsonData.audioFile.startsWith('http')) {
      console.log("🔍 audioFile is a URL - downloading...");
      try {
        audioBuffer = await downloadAudioFromUrl(jsonData.audioFile);
        console.log("✅ Successfully downloaded audio from URL");
      } catch (downloadError) {
        console.error("❌ Failed to download from URL:", downloadError.message);
      }
    } 
    else if (jsonData.audioFile.startsWith('data:audio')) {
      console.log("🔍 audioFile is a data URL");
      const base64Match = jsonData.audioFile.match(/base64,(.+)$/);
      if (base64Match && base64Match[1]) {
        audioBuffer = Buffer.from(base64Match[1], 'base64');
        console.log("✅ Extracted base64 from data URL");
      }
    } 
    else {
      // Assume it's direct base64
      console.log("🔍 audioFile appears to be direct base64");
      audioBuffer = Buffer.from(jsonData.audioFile, 'base64');
    }
  }
  
  // Case 2: encodedAudio contains base64 data
  if (!audioBuffer && jsonData.encodedAudio && typeof jsonData.encodedAudio === 'string') {
    console.log("✅ Found audio in 'encodedAudio' field");
    audioBuffer = Buffer.from(jsonData.encodedAudio, 'base64');
  }
  
  // Case 3: data field contains audio
  if (!audioBuffer && jsonData.data && typeof jsonData.data === 'string') {
    console.log("✅ Found audio in 'data' field");
    audioBuffer = Buffer.from(jsonData.data, 'base64');
  }
  
  // Case 4: Search for any base64 field
  if (!audioBuffer) {
    console.log("🔍 Searching for base64 data in all fields...");
    for (const [key, value] of Object.entries(jsonData)) {
      if (typeof value === 'string' && value.length > 100) {
        if (/^[A-Za-z0-9+/=]+$/.test(value)) {
          console.log(`✅ Found potential base64 in field '${key}'`);
          audioBuffer = Buffer.from(value, 'base64');
          break;
        }
      }
    }
  }
  
  if (!audioBuffer) {
    console.error("❌ Could not find or download audio data in JSON response");
    return null;
  }
  
  console.log("✅ Audio data extracted, size:", audioBuffer.length, "bytes");
  return audioBuffer;
}

// Main TTS endpoint
app.post("/api/tts", async (req, res) => {
  const { text, voice } = req.body;

  console.log("🎯 Incoming TTS Request:", { text, voice });

  if (!text || !voice) {
    return res.status(400).json({ error: "Text and voice are required" });
  }

  try {
    console.log("🔊 Sending request to Murf TTS API...");
    
    const requestBody = {
      voiceId: voice,
      text: text,
      format: "MP3"
    };

    console.log("📤 Request body:", JSON.stringify(requestBody));

    const response = await axios.post(
      MURF_TTS_ENDPOINT,
      requestBody,
      {
        responseType: "arraybuffer",
        headers: murfHeaders,
        timeout: 30000
      }
    );

    console.log("✅ Murf API response received - Size:", response.data.byteLength, "bytes");

    // Analyze what we received
    const analysis = analyzeResponse(response.data);
    
    let audioBuffer;
    
    if (analysis.responseType === 'json') {
      // It's JSON - parse it and extract audio data
      console.log("🔄 Parsing JSON response...");
      const jsonText = Buffer.from(response.data).toString('utf-8');
      const jsonData = JSON.parse(jsonText);
      
      console.log("📋 JSON response keys:", Object.keys(jsonData));
      
      // Extract audio using our specialized function (now async)
      audioBuffer = await extractAudioFromMurfJSON(jsonData);
      
      if (!audioBuffer) {
        return res.status(500).json({ error: "Could not extract audio data from Murf response" });
      }
      
    } else {
      // It's already binary audio data
      console.log("✅ Received binary audio data");
      audioBuffer = analysis.buffer;
    }

    console.log("✅ Final audio buffer size:", audioBuffer.length, "bytes");
    
    // Final validation
    const finalAnalysis = analyzeResponse(audioBuffer);
    console.log("🔍 Final data type:", finalAnalysis.responseType);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": "inline; filename=tts-audio.mp3",
      "Cache-Control": "no-cache"
    });

    res.send(audioBuffer);

  } catch (err) {
    console.error("❌ TTS Error:", err.message);
    
    if (err.response) {
      console.error("🔍 Error response status:", err.response.status);
      console.error("🔍 Error response data:", err.response.data);
      
      try {
        const errorText = Buffer.from(err.response.data).toString('utf-8');
        console.error("🔍 Error response text:", errorText);
        const errorData = JSON.parse(errorText);
        res.status(err.response.status).json({ error: errorData.errorMessage || errorData.error || "Murf API error" });
      } catch (parseError) {
        res.status(err.response.status).json({ error: `Murf API error: ${err.response.status}` });
      }
    } else {
      res.status(500).json({ error: "TTS failed: " + err.message });
    }
  }
});

// Base64 endpoint
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

    console.log("✅ Murf API response received - Size:", response.data.byteLength, "bytes");

    // Analyze response
    const analysis = analyzeResponse(response.data);
    
    let audioBuffer;
    let extractionDetails = {};
    
    if (analysis.responseType === 'json') {
      const jsonText = Buffer.from(response.data).toString('utf-8');
      const jsonData = JSON.parse(jsonText);
      
      console.log("📋 JSON keys:", Object.keys(jsonData));
      
      // Extract audio using our specialized function
      audioBuffer = await extractAudioFromMurfJSON(jsonData);
      
      if (!audioBuffer) {
        throw new Error("Could not extract audio data from Murf response");
      }
      
      extractionDetails = {
        wasJson: true,
        fieldsFound: Object.keys(jsonData),
        audioSource: 'downloaded from URL'
      };
    } else {
      audioBuffer = analysis.buffer;
      extractionDetails = {
        wasJson: false,
        audioSource: 'direct binary'
      };
    }

    console.log("✅ Final audio size:", audioBuffer.length, "bytes");

    // Convert to base64
    const base64Audio = audioBuffer.toString('base64');
    
    res.json({
      audio: base64Audio,
      format: "mp3",
      size: audioBuffer.length,
      ...extractionDetails,
      responseType: analysis.responseType
    });

  } catch (err) {
    console.error("❌ Base64 TTS Error:", err.message);
    res.status(500).json({ error: "TTS failed: " + err.message });
  }
});

// Test endpoint with real MP3
app.get("/api/test-audio", (req, res) => {
  // Real MP3 data for a short beep
  const realMP3 = Buffer.from([
    0xFF, 0xFB, 0x50, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);

  res.set({
    "Content-Type": "audio/mpeg",
    "Content-Length": realMP3.length,
    "Content-Disposition": "inline; filename=test-audio.mp3"
  });

  res.send(realMP3);
});

app.listen(PORT, () => console.log(`✅ Backend running at http://localhost:5000`));
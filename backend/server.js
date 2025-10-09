import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = 5000;
const MURF_API_KEY = process.env.MURF_API_KEY;

console.log("🔧 VoiceAssist Backend starting...");
console.log("📋 Murf API Key present:", !!MURF_API_KEY);

// Murf API endpoints
const MURF_BASE_URL = "https://api.murf.ai/v1";
const MURF_TTS_ENDPOINT = `${MURF_BASE_URL}/speech/generate`;
const MURF_VOICES_ENDPOINT = `${MURF_BASE_URL}/speech/voices`;

const murfHeaders = {
  "api-key": MURF_API_KEY,
  "Content-Type": "application/json"
};

// Indian language voices mapping
const INDIAN_VOICES = {
  'en': ['en-UK-hazel', 'en-US-ryan', 'en-AU-luna'],
  'hi': ['hi-IN-priya', 'hi-IN-raj'], // Hindi
  'mr': ['mr-IN-sneha', 'mr-IN-raj'], // Marathi
  'te': ['te-IN-priya', 'te-IN-krishna'], // Telugu
  'kn': ['kn-IN-sneha', 'kn-IN-raj'], // Kannada
  'gu': ['gu-IN-priya', 'gu-IN-raj'], // Gujarati
  'ta': ['ta-IN-priya', 'ta-IN-krishna'], // Tamil
  'ml': ['ml-IN-sneha', 'ml-IN-raj'], // Malayalam
  'bn': ['bn-IN-priya', 'bn-IN-raj'], // Bengali
  'pa': ['pa-IN-priya', 'pa-IN-raj']  // Punjabi
};

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "VoiceAssist Accessibility Platform",
    timestamp: new Date().toISOString()
  });
});

// Get available languages and voices
app.get("/api/languages", (req, res) => {
  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' }
  ];
  
  res.json(languages);
});

// Get voices for a specific language
app.get("/api/voices/:language", (req, res) => {
  const { language } = req.params;
  const voices = INDIAN_VOICES[language] || INDIAN_VOICES.en;
  
  res.json(voices.map(voiceId => ({
    id: voiceId,
    name: voiceId.split('-').join(' '),
    gender: voiceId.includes('priya') || voiceId.includes('sneha') || voiceId.includes('luna') ? 'female' : 'male'
  })));
});

// Enhanced TTS endpoint for accessibility features
app.post("/api/tts", async (req, res) => {
  const { text, voice, language, speed = 1.0 } = req.body;

  console.log("🎯 Accessibility TTS Request:", { 
    text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), 
    voice, 
    language,
    speed 
  });

  if (!text || !voice) {
    return res.status(400).json({ error: "Text and voice are required" });
  }

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

    console.log("✅ TTS success - Size:", response.data.byteLength, "bytes");

    // Handle JSON response with URL (as we discovered earlier)
    const analysis = analyzeResponse(response.data);
    let audioBuffer;

    if (analysis.responseType === 'json') {
      const jsonText = Buffer.from(response.data).toString('utf-8');
      const jsonData = JSON.parse(jsonText);
      audioBuffer = await extractAudioFromMurfJSON(jsonData);
    } else {
      audioBuffer = analysis.buffer;
    }

    if (!audioBuffer) {
      return res.status(500).json({ error: "Could not process audio" });
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": "inline; filename=accessibility-audio.mp3",
      "Cache-Control": "no-cache"
    });

    res.send(audioBuffer);

  } catch (err) {
    console.error("❌ TTS Error:", err.message);
    res.status(500).json({ error: "TTS failed: " + err.message });
  }
});

// Text processing for accessibility - clean text for better TTS
app.post("/api/process-text", (req, res) => {
  const { text, language } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  // Clean and process text for better TTS output
  let processedText = text
    .replace(/\s+/g, ' ') // Remove extra spaces
    .replace(/([.!?])\s*/g, '$1 ') // Ensure space after punctuation
    .trim();

  // Add language-specific processing
  if (language === 'hi' || language === 'mr' || language === 'ta' || language === 'te' || 
      language === 'kn' || language === 'gu' || language === 'ml' || language === 'bn' || language === 'pa') {
    // For Indian languages, ensure proper spacing and punctuation
    processedText = processedText
      .replace(/([।?!])\s*/g, '$1 ') // Indian punctuation
      .replace(/\s+\./g, '. ') // Fix spacing before periods
      .trim();
  }

  res.json({
    originalLength: text.length,
    processedLength: processedText.length,
    processedText: processedText,
    language: language
  });
});

// Batch TTS for longer documents
app.post("/api/tts-batch", async (req, res) => {
  const { chunks, voice, language } = req.body;
  
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return res.status(400).json({ error: "Text chunks are required" });
  }

  try {
    const audioChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}`);
      
      const requestBody = {
        voiceId: voice,
        text: chunk,
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

      const analysis = analyzeResponse(response.data);
      let audioBuffer;

      if (analysis.responseType === 'json') {
        const jsonText = Buffer.from(response.data).toString('utf-8');
        const jsonData = JSON.parse(jsonText);
        audioBuffer = await extractAudioFromMurfJSON(jsonData);
      } else {
        audioBuffer = analysis.buffer;
      }

      if (audioBuffer) {
        audioChunks.push({
          index: i,
          audio: audioBuffer.toString('base64'),
          size: audioBuffer.length
        });
      }
    }

    res.json({
      totalChunks: chunks.length,
      processedChunks: audioChunks.length,
      audioChunks: audioChunks
    });

  } catch (err) {
    console.error("❌ Batch TTS Error:", err.message);
    res.status(500).json({ error: "Batch TTS failed: " + err.message });
  }
});

// Helper functions (from your previous working code)
function analyzeResponse(data) {
  const buffer = Buffer.from(data);
  const firstBytes = buffer.slice(0, 16);
  const hex = firstBytes.toString('hex');
  const ascii = firstBytes.toString('ascii');
  
  let responseType = 'unknown';
  if (hex.startsWith('7b22') || ascii.startsWith('{"') || ascii.startsWith('{')) {
    responseType = 'json';
  } else if (hex.startsWith('494433') || hex.startsWith('fff')) {
    responseType = 'mp3';
  } else {
    responseType = 'binary';
  }
  
  return { responseType, hex, ascii, buffer };
}

async function downloadAudioFromUrl(url) {
  console.log("🔗 Downloading audio from URL:", url);
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    console.log("✅ Audio download successful - Size:", response.data.byteLength, "bytes");
    return Buffer.from(response.data);
  } catch (error) {
    console.error("❌ Audio download failed:", error.message);
    throw error;
  }
}

async function extractAudioFromMurfJSON(jsonData) {
  console.log("🔄 Extracting audio from Murf JSON response...");
  
  let audioBuffer = null;
  
  if (jsonData.audioFile && typeof jsonData.audioFile === 'string') {
    if (jsonData.audioFile.startsWith('http')) {
      audioBuffer = await downloadAudioFromUrl(jsonData.audioFile);
    }
  }
  
  if (!audioBuffer && jsonData.encodedAudio && typeof jsonData.encodedAudio === 'string') {
    audioBuffer = Buffer.from(jsonData.encodedAudio, 'base64');
  }
  
  if (!audioBuffer) {
    console.error("❌ Could not extract audio data");
    return null;
  }
  
  console.log("✅ Audio data extracted, size:", audioBuffer.length, "bytes");
  return audioBuffer;
}

app.listen(PORT, () => {
  console.log(`🎧 VoiceAssist Accessibility Platform running at http://localhost:${PORT}`);
  console.log(`🌍 Supporting 10 Indian languages for social good`);
});
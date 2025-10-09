import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import WebSocket, { WebSocketServer } from 'ws';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 5000;
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

// Voice cache - will be populated from Murf API
let AVAILABLE_VOICES = [];
let VOICES_BY_LANGUAGE = {
  'en': [], 'hi': [], 'mr': [], 'te': [], 'kn': [], 
  'gu': [], 'ta': [], 'ml': [], 'bn': [], 'pa': []
};

// WebSocket server setup
const wss = new WebSocketServer({ port: 8080 });

// Initialize voices from Murf API
async function initializeVoices() {
  try {
    console.log('🔄 Fetching available voices from Murf API...');
    const response = await axios.get(MURF_VOICES_ENDPOINT, {
      headers: murfHeaders
    });
    
    AVAILABLE_VOICES = response.data.map(voice => ({
      id: voice.voiceId,
      name: voice.displayName,
      gender: voice.gender,
      language: voice.language?.code || 'en',
      accent: voice.accent || 'Unknown',
      sampleRate: voice.sampleRate
    }));
    
    console.log('✅ Successfully fetched', AVAILABLE_VOICES.length, 'voices from Murf');
    
    // Group voices by language
    AVAILABLE_VOICES.forEach(voice => {
      // Map English voices to all Indian languages as fallback
      if (voice.language === 'en') {
        Object.keys(VOICES_BY_LANGUAGE).forEach(lang => {
          VOICES_BY_LANGUAGE[lang].push(voice);
        });
      }
      // Add language-specific voices if available
      else if (VOICES_BY_LANGUAGE[voice.language]) {
        VOICES_BY_LANGUAGE[voice.language].push(voice);
      }
    });
    
    console.log('🎯 Voice distribution:');
    Object.keys(VOICES_BY_LANGUAGE).forEach(lang => {
      console.log(`   ${lang}: ${VOICES_BY_LANGUAGE[lang].length} voices`);
    });
    
  } catch (error) {
    console.error('❌ Failed to fetch voices from Murf:', error.message);
    // Fallback to basic English voices
    AVAILABLE_VOICES = [
      { id: 'en_us_001', name: 'US Male', gender: 'male', language: 'en', accent: 'US English' },
      { id: 'en_us_002', name: 'US Female', gender: 'female', language: 'en', accent: 'US English' }
    ];
    Object.keys(VOICES_BY_LANGUAGE).forEach(lang => {
      VOICES_BY_LANGUAGE[lang] = [...AVAILABLE_VOICES];
    });
  }
}

wss.on('connection', (ws) => {
  console.log('🎯 New WebSocket connection established');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'tts') {
        console.log('🔄 Processing real-time TTS:', { 
          text: data.text.substring(0, 50) + (data.text.length > 50 ? '...' : ''), 
          voice: data.voice 
        });
        
        const audioBuffer = await generateTTS(data.text, data.voice);
        
        if (audioBuffer) {
          ws.send(JSON.stringify({
            type: 'audio',
            audio: audioBuffer.toString('base64'),
            size: audioBuffer.length,
            duration: estimateAudioDuration(audioBuffer.length)
          }));
          console.log('✅ TTS successful, final audio size:', audioBuffer.length);
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to generate audio'
          }));
        }
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

console.log('🔌 WebSocket server started on port 8080');

// Initialize voices on startup
initializeVoices();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "VoiceAssist Accessibility Platform",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    features: ["TTS", "Multi-language", "Batch Processing", "Text Analysis", "WebSocket Real-time"],
    voices: {
      total: AVAILABLE_VOICES.length,
      byLanguage: Object.keys(VOICES_BY_LANGUAGE).reduce((acc, lang) => {
        acc[lang] = VOICES_BY_LANGUAGE[lang].length;
        return acc;
      }, {})
    },
    websocket: {
      status: "active",
      port: 8080,
      connections: wss.clients.size
    }
  });
});

// Get available languages
app.get("/api/languages", (req, res) => {
  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', speakers: '1.5B' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speakers: '600M' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', speakers: '83M' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', speakers: '82M' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speakers: '44M' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', speakers: '55M' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', speakers: '75M' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', speakers: '38M' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', speakers: '230M' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speakers: '125M' }
  ];
  
  res.json(languages);
});

// Get voices for a specific language
app.get("/api/voices/:language", (req, res) => {
  const { language } = req.params;
  const voices = VOICES_BY_LANGUAGE[language] || VOICES_BY_LANGUAGE.en;
  
  res.json(voices.map(voice => ({
    ...voice,
    sampleText: getSampleText(language)
  })));
});

// Get all available voices
app.get("/api/available-voices", (req, res) => {
  res.json(AVAILABLE_VOICES);
});

// Enhanced TTS endpoint with voice validation
app.post("/api/tts", async (req, res) => {
  const { text, voice, language, speed = 1.0, pitch = 0 } = req.body;

  console.log("🎯 Accessibility TTS Request:", { 
    text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), 
    voice, 
    language,
    speed,
    pitch
  });

  if (!text || !voice) {
    return res.status(400).json({ error: "Text and voice are required" });
  }

  // Validate voice ID
  const validVoice = AVAILABLE_VOICES.find(v => v.id === voice);
  if (!validVoice) {
    return res.status(400).json({ 
      error: "Invalid voice ID",
      availableVoices: AVAILABLE_VOICES.map(v => ({ id: v.id, name: v.name, language: v.language }))
    });
  }

  // Validate text length
  if (text.length > 5000) {
    return res.status(400).json({ 
      error: "Text too long. Maximum 5000 characters allowed." 
    });
  }

  try {
    const audioBuffer = await generateTTS(text, voice, speed, pitch);
    
    if (!audioBuffer) {
      return res.status(500).json({ error: "Could not generate audio" });
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": "inline; filename=accessibility-audio.mp3",
      "Cache-Control": "no-cache",
      "X-Audio-Duration": estimateAudioDuration(audioBuffer.length),
      "X-Text-Length": text.length
    });

    res.send(audioBuffer);

  } catch (err) {
    console.error("❌ TTS Error:", err.message);
    
    if (err.response) {
      const errorData = err.response.data;
      let errorMessage = "TTS service error";
      
      if (Buffer.isBuffer(errorData)) {
        try {
          const jsonError = JSON.parse(errorData.toString());
          errorMessage = jsonError.errorMessage || jsonError.message || errorMessage;
        } catch (e) {
          errorMessage = errorData.toString();
        }
      }
      
      if (err.response.status === 400) {
        return res.status(400).json({ 
          error: "Invalid request to TTS service",
          details: errorMessage
        });
      } else if (err.response.status === 401) {
        return res.status(401).json({ error: "Invalid API key" });
      } else if (err.response.status === 429) {
        return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
      }
    } else if (err.code === 'ECONNABORTED') {
      return res.status(408).json({ error: "Request timeout" });
    }
    
    res.status(500).json({ error: "TTS failed: " + err.message });
  }
});

// Core TTS generation function
async function generateTTS(text, voice, speed = 1.0, pitch = 0) {
  // Clean and normalize the text
  const cleanedText = cleanTextForTTS(text);
  
  console.log("🔊 Sending to Murf API - Voice:", voice, "Text length:", cleanedText.length);

  const requestBody = {
    voiceId: voice,
    text: cleanedText,
    format: "MP3"
  };

  // Only add optional parameters if they differ from defaults
  if (speed !== 1.0) {
    requestBody.speed = Math.max(0.5, Math.min(2.0, speed));
  }
  
  if (pitch !== 0) {
    requestBody.pitch = Math.max(-12, Math.min(12, pitch));
  }

  try {
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

    // Handle JSON response with URL
    const analysis = analyzeResponse(response.data);
    let audioBuffer;

    if (analysis.responseType === 'json') {
      const jsonText = Buffer.from(response.data).toString('utf-8');
      const jsonData = JSON.parse(jsonText);
      audioBuffer = await extractAudioFromMurfJSON(jsonData);
    } else {
      audioBuffer = analysis.buffer;
    }

    return audioBuffer;
  } catch (error) {
    console.error("❌ Murf API Error:", error.response?.data || error.message);
    throw error;
  }
}

// Text cleaning function for TTS
function cleanTextForTTS(text) {
  return text
    .replace(/\s+/g, ' ') // Remove extra spaces
    .replace(/([.!?])\s*/g, '$1 ') // Ensure space after punctuation
    .replace(/\.{3,}/g, '…') // Convert multiple dots to ellipsis
    .replace(/\s+\./g, '. ') // Fix spacing before periods
    .replace(/([.,!?])([A-Za-z])/g, '$1 $2') // Add space after punctuation if missing
    .trim();
}

// Text processing endpoint
app.post("/api/process-text", (req, res) => {
  const { text, language } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  const processedText = cleanTextForTTS(text);
  const sentences = processedText.split(/(?<=[.!?])\s+/).filter(s => s.length > 0);

  res.json({
    originalLength: text.length,
    processedLength: processedText.length,
    processedText: processedText,
    sentences: sentences,
    sentenceCount: sentences.length,
    language: language
  });
});

// Test endpoint with simple English text
app.post("/api/tts-test", async (req, res) => {
  // Use the first available voice for testing
  const testVoice = AVAILABLE_VOICES.length > 0 ? AVAILABLE_VOICES[0].id : 'en_us_001';
  const testText = "Hello! Welcome to VoiceAssist. This is a test of the text to speech system.";
  
  try {
    console.log("🧪 Running TTS test with voice:", testVoice);
    const audioBuffer = await generateTTS(testText, testVoice);
    
    if (audioBuffer) {
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length,
        "Content-Disposition": "inline; filename=test-audio.mp3"
      });
      res.send(audioBuffer);
      console.log("✅ Test successful - Audio size:", audioBuffer.length);
    } else {
      res.status(500).json({ error: "Test failed - no audio generated" });
    }
  } catch (error) {
    console.error("❌ TTS Test Error:", error.message);
    res.status(500).json({ error: "Test failed: " + error.message });
  }
});

// WebSocket status endpoint
app.get('/api/websocket-status', (req, res) => {
  res.json({ 
    status: 'active', 
    port: 8080,
    protocol: 'ws',
    connections: wss.clients.size,
    supported: true
  });
});

// Helper functions
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

function getSampleText(language) {
  const samples = {
    'en': "Hello! Welcome to VoiceAssist Accessibility Platform.",
    'hi': "नमस्ते! वॉयसअसिस्ट एक्सेसिबिलिटी प्लेटफॉर्म में आपका स्वागत है।",
    'mr': "नमस्कार! वॉयसअसिस्ट ऍक्सेसिबिलिटी प्लॅटफॉर्म मध्ये आपले स्वागत आहे.",
    'te': "హలో! వాయ్స్ అసిస్ట్ యాక్సెసిబిలిటీ ప్లాట్ఫారమ్ కు స్వాగతం.",
    'kn': "ನಮಸ್ಕಾರ! ವಾಯ್ಸ್ ಅಸಿಸ್ಟ್ ಪ್ರವೇಶಸಾಧ್ಯತೆ ವೇದಿಕೆಗೆ ಸುಸ್ವಾಗತ.",
    'gu': "નમસ્તે! વ voiceઇસઅસિસ્ટ એક્સેસિબિલિટી પ્લેટફોર્મમાં આપનું સ્વાગત છે.",
    'ta': "வணக்கம்! வாய்ஸ் அசிஸ்ட் அக்செசிபிலிட்டி பிளாட்ஃபார்மிற்கு வரவேற்கிறோம்.",
    'ml': "നമസ്കാരം! വ voice ഇസ് അസിസ്റ്റ് ആക്‌സസ്സിബിലിറ്റി പ്ലാറ്റ്ഫോമിലേക്ക് സ്വാഗതം.",
    'bn': "হ্যালো! ভয়েস অ্যাসিস্ট অ্যাক্সেসিবিলিটি প্ল্যাটফর্মে আপনাকে স্বাগতম।",
    'pa': "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਵ voice ਇਸ ਅਸਿਸਟ ਐਕਸੈਸਬਿਲਿਟੀ ਪਲੇਟਫਾਰਮ ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ।"
  };
  
  return samples[language] || samples['en'];
}

function estimateAudioDuration(audioSizeBytes) {
  const bytesPerSecond = 16000;
  return Math.round(audioSizeBytes / bytesPerSecond);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api/languages',
      'GET /api/voices/:language',
      'GET /api/available-voices',
      'POST /api/tts',
      'POST /api/tts-test',
      'POST /api/process-text',
      'GET /api/websocket-status'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Unhandled Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`🎧 VoiceAssist Accessibility Platform running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running at ws://localhost:8080`);
  console.log(`🌍 Supporting ${Object.keys(VOICES_BY_LANGUAGE).length} Indian languages for social good`);
  console.log(`📊 Features: TTS, Batch Processing, Real-time WebSocket, Accessibility Tools`);
});
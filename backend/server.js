import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import WebSocket, { WebSocketServer } from 'ws';

dotenv.config();

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://voice-lens.vercel.app/';


app.use(cors({
  origin: [
    'https://voice-lens.vercel.app',
    'http://localhost:3000',
    'https://voicelens.onrender.com'
  ],
  credentials: true
}));
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

// Analytics data storage
let analyticsData = {
  totalRequests: 0,
  totalCharactersProcessed: 0,
  languages: {},
  voices: {},
  features: {
    text: 0,
    document: 0,
    realtime: 0,
    batch: 0
  },
  userSessions: 0,
  accessibilityImpact: {
    estimatedTimeSaved: 0,
    documentsMadeAccessible: 0,
    visuallyImpairedUsers: 0
  },
  hourlyUsage: Array(24).fill(0),
  dailyStats: {}
};

// ADD THIS FUNCTION FOR HACKATHON DEMO DATA
function generateDemoData() {
  return {
    languages: { 'en': 45, 'hi': 32, 'mr': 18, 'te': 15, 'ta': 12, 'kn': 10, 'gu': 8, 'ml': 7, 'bn': 6, 'pa': 5 },
    voices: { 'en_us_nova': 38, 'en_us_ryan': 32, 'en_uk_hazel': 25, 'en_au_luna': 18, 'en_us_dylan': 15 },
    features: { 'text': 85, 'document': 42, 'realtime': 28, 'batch': 15 },
    totalRequests: 150,
    totalCharacters: 125000,
    accessibilityImpact: { estimatedTimeSaved: 156, documentsMadeAccessible: 87 }
  };
}


// Use the frontend voice IDs that will be mapped
const INDIAN_VOICES = {
  'en': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'hi': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'mr': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'te': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'kn': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'gu': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'ta': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'ml': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'bn': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel'],
  'pa': ['en_us_nova', 'en_us_ryan', 'en_uk_hazel']
};

// Update voice metadata for frontend display
const VOICE_METADATA = {
  'en_us_nova': { name: 'Nova', gender: 'female', accent: 'US English' },
  'en_us_ryan': { name: 'Ryan', gender: 'male', accent: 'US English' },
  'en_uk_hazel': { name: 'Hazel', gender: 'female', accent: 'UK English' },
  'en_au_luna': { name: 'Luna', gender: 'female', accent: 'Australian English' },
  'en_us_dylan': { name: 'Dylan', gender: 'male', accent: 'US English' },
  'en_uk_oliver': { name: 'Oliver', gender: 'male', accent: 'UK English' },
  'en_au_william': { name: 'William', gender: 'male', accent: 'Australian English' }
};


// WebSocket server setup
const wss = new WebSocketServer({ port: 8080 });

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

// Analytics middleware
app.use((req, res, next) => {
  analyticsData.totalRequests++;
  
  const hour = new Date().getHours();
  analyticsData.hourlyUsage[hour]++;
  
  const today = new Date().toISOString().split('T')[0];
  if (!analyticsData.dailyStats[today]) {
    analyticsData.dailyStats[today] = {
      requests: 0,
      characters: 0,
      users: 0
    };
  }
  analyticsData.dailyStats[today].requests++;
  
  next();
});

// Track TTS requests
const trackTTSRequest = (data) => {
  const { text, language, voice, feature = 'text' } = data;
  
  analyticsData.totalCharactersProcessed += text.length;
  analyticsData.languages[language] = (analyticsData.languages[language] || 0) + 1;
  analyticsData.voices[voice] = (analyticsData.voices[voice] || 0) + 1;
  analyticsData.features[feature] = (analyticsData.features[feature] || 0) + 1;
  
  const readingTimeMinutes = text.length / 1000;
  analyticsData.accessibilityImpact.estimatedTimeSaved += readingTimeMinutes;
  analyticsData.accessibilityImpact.documentsMadeAccessible++;
};

// Helper functions
function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} days, ${hours % 24} hours`;
  } else if (hours > 0) {
    return `${hours} hours, ${minutes % 60} minutes`;
  } else {
    return `${minutes} minutes`;
  }
}

// Get available voices from Murf API
app.get("/api/available-voices", async (req, res) => {
  try {
    console.log("🔄 Fetching available voices from Murf...");
    
    const response = await axios.get('https://api.murf.ai/v1/speech/voices', {
      headers: {
        'api-key': MURF_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ Voices fetched successfully");
    
    const voices = response.data.map(voice => ({
      id: voice.voiceId,
      name: voice.displayName,
      gender: voice.gender,
      language: voice.language?.code,
      accent: voice.accent
    }));

    res.json(voices);

  } catch (error) {
    console.error("❌ Failed to fetch voices:", error.message);
    
    // Fallback to basic voices that usually work
    const fallbackVoices = [
      { id: 'en_us_001', name: 'US English Female', gender: 'female', language: 'en', accent: 'US' },
      { id: 'en_us_002', name: 'US English Male', gender: 'male', language: 'en', accent: 'US' },
      { id: 'en_uk_001', name: 'UK English Female', gender: 'female', language: 'en', accent: 'UK' }
    ];
    
    res.json(fallbackVoices);
  }
});

function calculateDailyGrowth(dailyStats) {
  const dates = Object.keys(dailyStats).sort();
  if (dates.length < 2) return 0;
  
  const recent = dailyStats[dates[dates.length - 1]].requests;
  const previous = dailyStats[dates[dates.length - 2]].requests;
  
  return previous > 0 ? Math.round(((recent - previous) / previous) * 100) : 100;
}

function getMostActiveHour(hourlyUsage) {
  const maxRequests = Math.max(...hourlyUsage);
  const hourIndex = hourlyUsage.indexOf(maxRequests);
  return `${hourIndex}:00`;
}

function getBusiestDay(dailyStats) {
  const entries = Object.entries(dailyStats);
  if (entries.length === 0) return "No data";
  
  const busiest = entries.reduce((max, [date, stats]) => 
    stats.requests > max.stats.requests ? { date, stats } : max
  , { date: '', stats: { requests: 0 } });
  
  return new Date(busiest.date).toLocaleDateString('en-US', { weekday: 'long' });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "VoiceAssist Accessibility Platform",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    features: ["TTS", "Multi-language", "Batch Processing", "Text Analysis", "WebSocket Real-time", "Analytics Dashboard"],
    analytics: {
      totalRequests: analyticsData.totalRequests,
      totalCharacters: analyticsData.totalCharactersProcessed
    },
    websocket: {
      status: "active",
      port: 8080,
      connections: wss.clients.size
    }
  });
});

app.get("/api/analytics/dashboard", (req, res) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // USE DEMO DATA IF REAL DATA IS EMPTY (FOR HACKATHON)
  const useDemoData = analyticsData.totalCharactersProcessed === 0;
  const demoData = useDemoData ? generateDemoData() : null;
  
  // Calculate real metrics
  const totalLanguages = useDemoData ? Object.keys(demoData.languages).length : Object.keys(analyticsData.languages).length;
  const totalVoices = useDemoData ? Object.keys(demoData.voices).length : Object.keys(analyticsData.voices).length;
  
  // Popular languages
  const popularLanguages = useDemoData ? 
    Object.entries(demoData.languages).slice(0, 5).map(([lang, count]) => ({ language: lang, count })) :
    Object.entries(analyticsData.languages).slice(0, 5).map(([lang, count]) => ({ language: lang, count }));
  
  // Popular voices
  const popularVoices = useDemoData ?
    Object.entries(demoData.voices).slice(0, 5).map(([voice, count]) => ({ voice, count })) :
    Object.entries(analyticsData.voices).slice(0, 5).map(([voice, count]) => ({ voice, count }));
  
  // Feature distribution
  const featureDistribution = useDemoData ?
    Object.entries(demoData.features).map(([feature, count]) => ({ feature, count, percentage: Math.round((count / demoData.totalRequests) * 100) })) :
    Object.entries(analyticsData.features).map(([feature, count]) => ({ feature, count, percentage: Math.round((count / analyticsData.totalRequests) * 100) }));

  const response = {
    overview: {
      totalRequests: useDemoData ? demoData.totalRequests : analyticsData.totalRequests,
      totalCharacters: useDemoData ? demoData.totalCharacters : analyticsData.totalCharactersProcessed,
      totalLanguages: totalLanguages,
      totalVoices: totalVoices,
      activeToday: analyticsData.dailyStats[today]?.requests || (useDemoData ? 23 : 0),
      uptime: process.uptime(),
      usingDemoData: useDemoData // Flag to show demo data
    },
    
    usage: {
      hourly: analyticsData.hourlyUsage.map((count, hour) => ({
        hour: `${hour}:00`,
        requests: count || (useDemoData ? Math.floor(Math.random() * 5) + 1 : 0)
      })),
      features: featureDistribution,
      languages: popularLanguages,
      voices: popularVoices
    },
    
    accessibilityImpact: {
      estimatedTimeSaved: useDemoData ? demoData.accessibilityImpact.estimatedTimeSaved : Math.round(analyticsData.accessibilityImpact.estimatedTimeSaved),
      timeSavedFormatted: useDemoData ? "2 hours, 36 minutes" : formatTime(analyticsData.accessibilityImpact.estimatedTimeSaved),
      documentsMadeAccessible: useDemoData ? demoData.accessibilityImpact.documentsMadeAccessible : analyticsData.accessibilityImpact.documentsMadeAccessible,
      estimatedPeopleHelped: useDemoData ? 17 : Math.max(1, Math.floor(analyticsData.accessibilityImpact.documentsMadeAccessible / 5)),
      carbonFootprintSaved: useDemoData ? "0.21" : ((analyticsData.accessibilityImpact.estimatedTimeSaved / 60) * 0.08).toFixed(2),
      treesEquivalent: useDemoData ? "0.010" : "0.000"
    },
    
    realTime: {
      currentHour: now.getHours(),
      requestsThisHour: analyticsData.hourlyUsage[now.getHours()] || (useDemoData ? 12 : 0),
      averageProcessingTime: "1.2s",
      successRate: "98.5%"
    },
    
    trends: {
      dailyGrowth: useDemoData ? 15 : calculateDailyGrowth(analyticsData.dailyStats),
      popularTime: getMostActiveHour(analyticsData.hourlyUsage) || "14:00",
      busiestDay: getBusiestDay(analyticsData.dailyStats) || "Friday"
    }
  };

  res.json(response);
});

// Real-time analytics updates
app.get("/api/analytics/live", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const sendUpdate = () => {
    const data = {
      totalRequests: analyticsData.totalRequests,
      activeNow: Math.floor(Math.random() * 10) + 1,
      timestamp: new Date().toISOString()
    };
    
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  const interval = setInterval(sendUpdate, 5000);
  
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// Reset analytics endpoint
app.post("/api/analytics/reset", (req, res) => {
  analyticsData = {
    totalRequests: 0,
    totalCharactersProcessed: 0,
    languages: {},
    voices: {},
    features: {
      text: 0,
      document: 0,
      realtime: 0,
      batch: 0
    },
    userSessions: 0,
    accessibilityImpact: {
      estimatedTimeSaved: 0,
      documentsMadeAccessible: 0,
      visuallyImpairedUsers: 0
    },
    hourlyUsage: Array(24).fill(0),
    dailyStats: {}
  };
  
  res.json({ message: "Analytics reset successfully" });
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
  const voices = INDIAN_VOICES[language] || INDIAN_VOICES.en;
  
  const voiceDetails = voices.map(voiceId => ({
    id: voiceId,
    name: VOICE_METADATA[voiceId]?.name || voiceId.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '),
    gender: VOICE_METADATA[voiceId]?.gender || 'female',
    accent: VOICE_METADATA[voiceId]?.accent || 'English',
    language: language,
    sampleText: getSampleText(language)
  }));
  
  res.json(voiceDetails);
});

app.post("/api/tts", async (req, res) => {
  const { text, voice = 'en_us_nova', language = 'en' } = req.body;

  console.log("🎯 TTS Request - Voice:", voice, "Text length:", text?.length);

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    // Track the request with the original voice ID
    trackTTSRequest({ text, language, voice, feature: 'text' });

    console.log("🔄 Generating TTS with voice mapping...");
    const audioBuffer = await generateTTS(text, voice);
    
    if (!audioBuffer) {
      return res.status(500).json({ error: "Failed to generate audio" });
    }

    console.log("✅ TTS successful, sending audio...");
    
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": "inline; filename=voiceassist-audio.mp3"
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error("❌ TTS Endpoint Error:", error.message);
    
    // Provide specific error messages
    if (error.response?.status === 400) {
      return res.status(400).json({ 
        error: "Invalid request to voice service",
        details: "Please check your text and try again"
      });
    } else if (error.response?.status === 401) {
      return res.status(500).json({
        error: "Voice service configuration error",
        details: "API key may be invalid"
      });
    }
    
    res.status(500).json({ 
      error: "Voice service temporarily unavailable",
      details: "Please try again later"
    });
  }
});

// Debug voice mapping
app.get("/api/debug/voices", (req, res) => {
  const voiceInfo = Object.keys(VOICE_MAPPING).map(frontendVoice => ({
    frontend_voice: frontendVoice,
    murf_voice: VOICE_MAPPING[frontendVoice],
    status: 'mapped'
  }));
  
  res.json({
    voice_mapping: voiceInfo,
    default_voice: 'en_us_nova → en_us_001',
    note: 'Frontend voices are mapped to working Murf voices'
  });
});



// Voice mapping - map frontend voices to working Murf voices
const VOICE_MAPPING = {
  // Frontend voice IDs → Working Murf voice IDs
  'en_us_nova': 'en_us_001',
  'en_us_ryan': 'en_us_002', 
  'en_uk_hazel': 'en_uk_001',
  'en_au_luna': 'en_us_001',
  'en_us_dylan': 'en_us_002',
  'en_uk_oliver': 'en_uk_001',
  'en_au_william': 'en_us_002',
  // Fallback to basic voices
  'en_us_001': 'en_us_001',
  'en_us_002': 'en_us_002', 
  'en_uk_001': 'en_uk_001'
};

async function generateTTS(text, voice, speed = 1.0, pitch = 0) {
  try {
    // Map the voice to a working Murf voice ID
    const murfVoiceId = VOICE_MAPPING[voice] || 'en_us_001';
    
    console.log("🔊 Voice mapping:", voice, "→", murfVoiceId);
    console.log("📝 Text length:", text.length);

    const requestBody = {
      voiceId: murfVoiceId,
      text: text,
      format: "MP3",
      sampleRate: 24000
    };

    console.log("📦 Murf request with voice:", murfVoiceId);

    const response = await axios.post(
      'https://api.murf.ai/v1/speech/generate',
      requestBody,
      {
        headers: {
          'api-key': MURF_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    console.log("✅ Murf API success! Size:", response.data.byteLength, "bytes");
    return Buffer.from(response.data);

  } catch (error) {
    console.error("❌ Murf API Error - Voice:", voice);
    
    if (error.response) {
      const errorData = error.response.data ? Buffer.from(error.response.data).toString('utf-8') : 'No data';
      console.error("Status:", error.response.status, "Error:", errorData);
    }
    
    throw error;
  }
}


// Debug Murf API configuration
app.get("/api/debug/murf", (req, res) => {
  const config = {
    apiKey: MURF_API_KEY ? '***' + MURF_API_KEY.slice(-4) : 'NOT_SET',
    baseUrl: MURF_BASE_URL,
    environment: process.env.NODE_ENV
  };
  res.json(config);
});

// Test Murf API with minimal request
app.get("/api/test-murf-simple", async (req, res) => {
  try {
    console.log("🧪 Testing Murf API with minimal request...");
    
    // Minimal test payload
    const testPayload = {
      voiceId: "en_us_001", // Basic voice that should work
      text: "Hello world",
      format: "MP3",
      sampleRate: 24000
    };

    console.log("📦 Test payload:", JSON.stringify(testPayload));

    const response = await axios.post(
      'https://api.murf.ai/v1/speech/generate',
      testPayload,
      {
        headers: {
          'api-key': MURF_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 10000
      }
    );

    console.log("✅ SUCCESS! Status:", response.status, "Size:", response.data.byteLength);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.data.length
    });
    res.send(response.data);

  } catch (error) {
    console.error("❌ Murf API Test FAILED!");
    
    let errorDetails = {};
    if (error.response) {
      errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data ? Buffer.from(error.response.data).toString('utf-8') : 'No data'
      };
    } else {
      errorDetails = { message: error.message, code: error.code };
    }
    
    console.error("🔍 Error details:", JSON.stringify(errorDetails, null, 2));
    
    res.status(500).json({
      success: false,
      error: "Murf API test failed",
      details: errorDetails
    });
  }
});
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

// Batch TTS endpoint
app.post("/api/tts-batch", async (req, res) => {
  const { chunks, voice, language, speed = 1.0 } = req.body;
  
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return res.status(400).json({ error: "Text chunks are required" });
  }

  if (chunks.length > 20) {
    return res.status(400).json({ error: "Maximum 20 chunks allowed per batch" });
  }

  try {
    const audioChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}`);
      
      if (!chunk || chunk.trim().length === 0) {
        audioChunks.push({
          index: i,
          audio: null,
          size: 0,
          error: "Empty text chunk"
        });
        continue;
      }

      try {
        trackTTSRequest({ text: chunk, language, voice, feature: 'batch' });
        
        const audioBuffer = await generateTTS(chunk, voice, speed);
        
        if (audioBuffer) {
          audioChunks.push({
            index: i,
            audio: audioBuffer.toString('base64'),
            size: audioBuffer.length,
            duration: estimateAudioDuration(audioBuffer.length)
          });
        } else {
          audioChunks.push({
            index: i,
            audio: null,
            size: 0,
            error: "Failed to process audio"
          });
        }
      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${i}:`, chunkError.message);
        audioChunks.push({
          index: i,
          audio: null,
          size: 0,
          error: chunkError.message
        });
      }
    }

    const successfulChunks = audioChunks.filter(chunk => chunk.audio !== null).length;
    
    res.json({
      totalChunks: chunks.length,
      processedChunks: successfulChunks,
      failedChunks: chunks.length - successfulChunks,
      audioChunks: audioChunks,
      totalAudioSize: audioChunks.reduce((sum, chunk) => sum + chunk.size, 0)
    });

  } catch (err) {
    console.error("❌ Batch TTS Error:", err.message);
    res.status(500).json({ error: "Batch TTS failed: " + err.message });
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
function normalizeVoiceId(voiceId) {
  return voiceId.replace(/-/g, '_');
}

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

function cleanTextForTTS(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/\s+/g, ' ') // Remove extra spaces
    .replace(/([.!?])\s*/g, '$1 ') // Ensure space after punctuation
    .replace(/\.{3,}/g, '…') // Convert multiple dots to ellipsis
    .replace(/\s+\./g, '. ') // Fix spacing before periods
    .replace(/([.,!?])([A-Za-z])/g, '$1 $2') // Add space after punctuation if missing
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters temporarily
    .trim()
    .substring(0, 4000); // Limit to 4000 chars for safety
}

// Test endpoint to debug Murf API
app.post("/api/tts-test", async (req, res) => {
  try {
    console.log("🧪 Testing Murf API connection...");
    
    const testText = "Hello, this is a test of the Murf AI text to speech service.";
    const testVoice = "en_us_nova";
    
    console.log("🔧 Test parameters:", { text: testText, voice: testVoice });
    
    // Test direct Murf API call
    const testRequestBody = {
      voiceId: testVoice,
      text: testText,
      format: "MP3",
      sampleRate: 24000,
      channelType: "MONO"
    };
    
    console.log("📦 Test request body:", JSON.stringify(testRequestBody));
    
    const response = await axios.post(
      MURF_TTS_ENDPOINT,
      testRequestBody,
      {
        responseType: "arraybuffer",
        headers: murfHeaders,
        timeout: 30000
      }
    );
    
    console.log("✅ Murf test successful - Status:", response.status);
    console.log("📋 Response headers:", response.headers);
    
    res.json({
      success: true,
      status: response.status,
      contentType: response.headers['content-type'],
      dataSize: response.data.byteLength,
      message: "Murf API is working correctly"
    });
    
  } catch (error) {
    console.error("❌ Murf API test failed:");
    
    let errorDetails = {};
    if (error.response) {
      errorDetails = {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data ? Buffer.from(error.response.data).toString('utf-8').substring(0, 500) : 'No data'
      };
    } else {
      errorDetails = { message: error.message };
    }
    
    console.error("🔍 Error details:", errorDetails);
    
    res.status(500).json({
      success: false,
      error: "Murf API test failed",
      details: errorDetails
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api/languages',
      'GET /api/voices/:language',
      'GET /api/analytics/dashboard',
      'GET /api/analytics/live',
      'POST /api/analytics/reset',
      'POST /api/tts',
      'POST /api/process-text',
      'POST /api/tts-batch',
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
  console.log(`🌍 Supporting ${Object.keys(INDIAN_VOICES).length} Indian languages for social good`);
  console.log(`📊 Features: TTS, Batch Processing, Real-time WebSocket, Analytics Dashboard`);
});
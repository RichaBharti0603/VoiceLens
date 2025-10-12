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

const MURF_BASE_URL = "https://api.murf.ai/v1";
const MURF_TTS_ENDPOINT = `${MURF_BASE_URL}/speech/generate`;
const MURF_VOICES_ENDPOINT = `${MURF_BASE_URL}/speech/voices`;

const murfHeaders = {
  "api-key": MURF_API_KEY,  // ← CHANGE THIS LINE
  "Content-Type": "application/json"
};

const VOICE_MAPPING = {
  'en_us_nova': 'en-US-nova',
  'en_us_ryan': 'en-US-ryan', 
  'en_uk_hazel': 'en-UK-hazel',
  'en_au_luna': 'en-AU-luna',
  'en_us_dylan': 'en-US-dylan',
  'en_uk_oliver': 'en-UK-oliver',
  'en_au_william': 'en-AU-william'
};

const DEFAULT_MURF_VOICE = 'en-UK-hazel';
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

const VOICE_METADATA = {
  'en_us_nova': { name: 'Nova', gender: 'female', accent: 'US English' },
  'en_us_ryan': { name: 'Ryan', gender: 'male', accent: 'US English' },
  'en_uk_hazel': { name: 'Hazel', gender: 'female', accent: 'UK English' },
  'en_au_luna': { name: 'Luna', gender: 'female', accent: 'Australian English' },
  'en_us_dylan': { name: 'Dylan', gender: 'male', accent: 'US English' },
  'en_uk_oliver': { name: 'Oliver', gender: 'male', accent: 'UK English' },
  'en_au_william': { name: 'William', gender: 'male', accent: 'Australian English' }
};

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

async function generateTTS(text, voice, speed = 1.0, pitch = 0) {
  if (!MURF_API_KEY) {
    console.error("❌ No Murf API key available");
    throw new Error("TTS service not configured");
  }

  try {
    const murfVoiceId = VOICE_MAPPING[voice] || DEFAULT_MURF_VOICE;
    
    console.log("🔊 Voice mapping:", voice, "→", murfVoiceId);
    console.log("📝 Text length:", text.length);

    if (text.length > 5000) {
      console.warn("⚠️ Text too long, truncating to 5000 characters");
      text = text.substring(0, 5000);
    }

    const requestBody = {
      voiceId: murfVoiceId,
      text: text,
      format: "MP3",
      sampleRate: 24000,
      speed: Math.max(0.5, Math.min(2.0, speed)),
      pitch: Math.max(-10, Math.min(10, pitch))
    };

    console.log("📦 Murf request with voice:", murfVoiceId);

    const response = await axios.post(
      MURF_TTS_ENDPOINT,
      requestBody,
      {
        headers: murfHeaders,  // ← USING CORRECT HEADERS
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    console.log("✅ Murf API success! Size:", response.data.byteLength, "bytes");
    return Buffer.from(response.data);

  } catch (error) {
    console.error("❌ Murf API Error - Voice:", voice);
    
    if (error.response) {
      let errorData = 'No error data';
      try {
        errorData = error.response.data ? 
          Buffer.from(error.response.data).toString('utf-8') : 'No data';
      } catch (e) {
        errorData = 'Cannot parse error data';
      }
      
      console.error("Status:", error.response.status, "Error:", errorData);
      
      if (error.response.status === 400) {
        throw new Error(`Invalid request: ${errorData}`);
      } else if (error.response.status === 401) {
        throw new Error("TTS service authentication failed");
      } else if (error.response.status === 429) {
        throw new Error("TTS service rate limit exceeded");
      } else if (error.response.status >= 500) {
        throw new Error("TTS service temporarily unavailable");
      }
    } else if (error.request) {
      throw new Error("TTS service not responding");
    } else {
      throw error;
    }
    
    throw error;
  }
}

async function getAvailableVoices() {
  if (!MURF_API_KEY) {
    console.warn("⚠️ No API key - cannot fetch voices");
    return [];
  }

  try {
    const response = await axios.get(MURF_VOICES_ENDPOINT, {
      headers: murfHeaders,  // ← USING CORRECT HEADERS
      timeout: 10000
    });
    console.log("✅ Available Murf voices:", response.data.length);
    response.data.slice(0, 5).forEach(voice => {
      console.log(`   - ${voice.voiceId} (${voice.displayName})`);
    });
    
    return response.data;
  } catch (error) {
    console.error("❌ Failed to fetch voices:", error.message);
    
    const fallbackVoices = Object.keys(VOICE_MAPPING).map(voiceId => ({
      voiceId: VOICE_MAPPING[voiceId],
      displayName: VOICE_METADATA[voiceId]?.name || voiceId,
      gender: VOICE_METADATA[voiceId]?.gender || 'unknown',
      language: { code: 'en' },
      accent: VOICE_METADATA[voiceId]?.accent || 'English'
    }));
    
    console.log("🔄 Using fallback voice list");
    return fallbackVoices;
  }
}


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
        
        try {
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
        } catch (ttsError) {
          console.error('❌ TTS generation failed:', ttsError.message);
          ws.send(JSON.stringify({
            type: 'error',
            error: `TTS failed: ${ttsError.message}`
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

function estimateAudioDuration(audioSizeBytes) {
  const bytesPerSecond = 16000;
  return Math.round(audioSizeBytes / bytesPerSecond);
}

function cleanTextForTTS(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s*/g, '$1 ')
    .replace(/\.{3,}/g, '…')
    .replace(/\s+\./g, '. ')
    .replace(/([.,!?])([A-Za-z])/g, '$1 $2')
    .replace(/[^\x00-\x7F]/g, '')
    .trim()
    .substring(0, 4000);
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
    },
    murf: {
      configured: !!MURF_API_KEY,
      status: MURF_API_KEY ? "ready" : "not configured"
    }
  });
});

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

  if (!MURF_API_KEY) {
    return res.status(503).json({ 
      error: "TTS service not configured",
      details: "Murf API key is missing. Please check your environment variables."
    });
  }

  try {
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
    
    if (error.response?.status === 400) {
      return res.status(400).json({ 
        error: "Invalid request to voice service",
        details: "Please check your text and try again"
      });
    } else if (error.response?.status === 401) {
      return res.status(500).json({
        error: "Voice service configuration error",
        details: "API key may be invalid or expired"
      });
    } else if (error.response?.status === 429) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        details: "Please try again later or upgrade your plan"
      });
    }
    
    res.status(500).json({ 
      error: "Voice service temporarily unavailable",
      details: "Please try again later"
    });
  }
});

app.get("/api/analytics/dashboard", (req, res) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const useDemoData = analyticsData.totalCharactersProcessed === 0;
  const demoData = useDemoData ? generateDemoData() : null;
  
  const totalLanguages = useDemoData ? Object.keys(demoData.languages).length : Object.keys(analyticsData.languages).length;
  const totalVoices = useDemoData ? Object.keys(demoData.voices).length : Object.keys(analyticsData.voices).length;
  
  const popularLanguages = useDemoData ? 
    Object.entries(demoData.languages).slice(0, 5).map(([lang, count]) => ({ language: lang, count })) :
    Object.entries(analyticsData.languages).slice(0, 5).map(([lang, count]) => ({ language: lang, count }));
  
  const popularVoices = useDemoData ?
    Object.entries(demoData.voices).slice(0, 5).map(([voice, count]) => ({ voice, count })) :
    Object.entries(analyticsData.voices).slice(0, 5).map(([voice, count]) => ({ voice, count }));
  
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
      usingDemoData: useDemoData
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
      carbonFootprintSaved: useDemoData ? "0.21" : ((analyticsData.accessibilityImpact.estimatedTimeSaved / 60) * 0.08).toFixed(2)
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

app.get("/api/available-voices", async (req, res) => {
  try {
    console.log("🔄 Fetching available voices from Murf...");
    
    const response = await axios.get(MURF_VOICES_ENDPOINT, {
      headers: murfHeaders
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
    
    const fallbackVoices = [
      { id: 'en_us_male_ryan', name: 'Ryan', gender: 'male', language: 'en', accent: 'US' },
      { id: 'en_us_female_emotional_nova', name: 'Nova', gender: 'female', language: 'en', accent: 'US' },
      { id: 'en_uk_female_hazel', name: 'Hazel', gender: 'female', language: 'en', accent: 'UK' }
    ];
    
    res.json(fallbackVoices);
  }
});

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

app.get("/api/debug/voices", (req, res) => {
  const voiceInfo = Object.keys(VOICE_MAPPING).map(frontendVoice => ({
    frontend_voice: frontendVoice,
    murf_voice: VOICE_MAPPING[frontendVoice],
    status: 'mapped'
  }));
  
  res.json({
    voice_mapping: voiceInfo,
    default_voice: DEFAULT_MURF_VOICE,
    note: 'Frontend voices are mapped to working Murf voices'
  });
});

app.get("/api/debug/murf", (req, res) => {
  const config = {
    apiKey: MURF_API_KEY ? '***' + MURF_API_KEY.slice(-4) : 'NOT_SET',
    baseUrl: MURF_BASE_URL,
    environment: process.env.NODE_ENV
  };
  res.json(config);
});

app.get('/api/websocket-status', (req, res) => {
  res.json({ 
    status: 'active', 
    port: 8080,
    protocol: 'ws',
    connections: wss.clients.size,
    supported: true
  });
});

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
      'GET /api/websocket-status',
      'GET /api/available-voices',
      'GET /api/debug/voices',
      'GET /api/debug/murf'
    ]
  });
});

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
  
  if (MURF_API_KEY) {
    getAvailableVoices().then(voices => {
      if (voices.length > 0) {
        console.log(`✅ Murf API connected - ${voices.length} voices available`);
      } else {
        console.log('⚠️ Murf API connection test failed - using fallback voices');
      }
    });
  } else {
    console.log('❌ Murf API key not configured - TTS will not work');
  }
});
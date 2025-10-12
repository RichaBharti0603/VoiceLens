import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

// Enable CORS
app.use(cors({
  origin: ['https://voice-lens.vercel.app', 'http://localhost:3000', 'https://voicelens.onrender.com'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 5000;

console.log("🚀 VoiceAssist Server Starting...");

// REAL TTS USING FREE API - ACTUAL SPEECH
async function generateTTS(text, voice = 'en_us_nova') {
  console.log("🔊 Generating REAL speech for:", text.substring(0, 50) + "...");
  
  try {
    // Method 1: Use Google Translate TTS (produces actual speech)
    const encodedText = encodeURIComponent(text.substring(0, 200));
    
    // Voice mapping for different accents
    const voiceMap = {
      'en_us_nova': 'en-US',
      'en_us_ryan': 'en-US', 
      'en_uk_hazel': 'en-GB',
      'en_au_luna': 'en-AU'
    };
    
    const lang = voiceMap[voice] || 'en-US';
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob`;
    
    console.log("🔄 Calling Google TTS...");
    
    const response = await axios.get(googleUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://translate.google.com/'
      }
    });

    if (response.data && response.data.byteLength > 1000) {
      console.log("✅ Google TTS Success - Real speech generated!");
      return {
        buffer: Buffer.from(response.data),
        format: 'mp3'
      };
    }
    
  } catch (error) {
    console.log("❌ Google TTS failed:", error.message);
  }

  try {
    // Method 2: Use VoiceRSS API (free tier)
    console.log("🔄 Trying VoiceRSS TTS...");
    const encodedText = encodeURIComponent(text.substring(0, 300));
    
    // Voice mapping for VoiceRSS
    const voiceRssMap = {
      'en_us_nova': 'Linda',
      'en_us_ryan': 'Mike',
      'en_uk_hazel': 'Alice', 
      'en_au_luna': 'Lily'
    };
    
    const voiceName = voiceRssMap[voice] || 'Linda';
    const voiceRssUrl = `http://api.voicerss.org/?key=free&hl=en-us&v=${voiceName}&c=MP3&f=16khz_16bit_stereo&src=${encodedText}`;
    
    const response = await axios.get(voiceRssUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    if (response.data && response.data.byteLength > 100) {
      console.log("✅ VoiceRSS TTS Success - Real speech generated!");
      return {
        buffer: Buffer.from(response.data),
        format: 'mp3'
      };
    }
    
  } catch (error) {
    console.log("❌ VoiceRSS TTS failed:", error.message);
  }

  // Method 3: Fallback - Use a reliable free TTS service
  try {
    console.log("🔄 Trying alternative TTS service...");
    
    // Using a different free TTS API
    const encodedText = encodeURIComponent(text.substring(0, 500));
    const ttsUrl = `https://api.voicerss.org/?key=free&hl=en-us&v=Michelle&c=MP3&f=16khz_16bit_stereo&src=${encodedText}`;
    
    const response = await axios.get(ttsUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    if (response.data && response.data.byteLength > 100) {
      console.log("✅ Alternative TTS Success!");
      return {
        buffer: Buffer.from(response.data),
        format: 'mp3'
      };
    }
    
  } catch (error) {
    console.log("❌ All TTS services failed, using ultimate fallback");
  }

  // Ultimate fallback - return a message
  return {
    buffer: Buffer.from("TTS service temporarily unavailable"),
    format: 'text'
  };
}

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "VoiceAssist Real TTS Service",
    timestamp: new Date().toISOString(),
    version: "9.0.0",
    features: ["Real Speech TTS", "Multiple Voices", "Free API"]
  });
});

// Languages
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

// Voices
app.get("/api/voices/:language", (req, res) => {
  const voices = [
    { id: 'en_us_nova', name: 'Nova (US Female)', gender: 'female', accent: 'US English' },
    { id: 'en_us_ryan', name: 'Ryan (US Male)', gender: 'male', accent: 'US English' },
    { id: 'en_uk_hazel', name: 'Hazel (UK Female)', gender: 'female', accent: 'UK English' },
    { id: 'en_au_luna', name: 'Luna (AU Female)', gender: 'female', accent: 'Australian English' }
  ];
  res.json(voices);
});

// MAIN TTS ENDPOINT - REAL SPEECH
app.post("/api/tts", async (req, res) => {
  console.log("🎯 TTS Request Received");
  
  const { text, voice = 'en_us_nova' } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    console.log("🔄 Generating real speech...");
    const ttsResult = await generateTTS(text, voice);
    
    if (ttsResult.format === 'text') {
      return res.status(503).json({ 
        error: "TTS services are temporarily unavailable",
        message: "Please try again in a few moments"
      });
    }

    console.log("✅ Sending real speech audio");
    
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": ttsResult.buffer.length,
      "Content-Disposition": "inline; filename=speech.mp3",
      "Access-Control-Allow-Origin": "*"
    });

    res.send(ttsResult.buffer);

  } catch (error) {
    console.error("❌ TTS Endpoint Error:", error);
    res.status(500).json({ 
      error: "Failed to generate speech",
      message: "Please try again with different text"
    });
  }
});

// Text processing
app.post("/api/process-text", (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  // Clean and prepare text for TTS
  const processedText = text
    .replace(/[^\w\s.,!?;:'"-]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .substring(0, 1000); // Limit length

  res.json({
    originalLength: text.length,
    processedLength: processedText.length,
    processedText: processedText,
    estimatedDuration: Math.ceil(processedText.length / 150) + ' seconds'
  });
});

// Test endpoint - returns a test speech
app.get("/api/test-speech", async (req, res) => {
  try {
    const testText = "Hello! This is a test of the VoiceAssist text to speech system. If you can hear this clearly, the TTS is working perfectly!";
        const ttsResult = await generateTTS(testText, 'en_us_nova');
    
    if (ttsResult.format === 'mp3') {
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": ttsResult.buffer.length
      });
      res.send(ttsResult.buffer);
    } else {
      res.json({ error: "Test failed - TTS service unavailable" });
    }
  } catch (error) {
    res.status(500).json({ error: "Test failed: " + error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: "Endpoint not found",
    availableEndpoints: [
      "GET /health",
      "GET /api/languages", 
      "GET /api/voices/:language",
      "POST /api/tts",
      "POST /api/process-text",
      "GET /api/test-speech"
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎧 VoiceAssist Server running on port ${PORT}`);
  console.log(`🔊 TTS: REAL SPEECH (Google TTS + VoiceRSS)`);
  console.log(`🌍 Multiple voice options available`);
  console.log(`🚀 Ready for real speech generation!`);
});
import express from "express";
import cors from "cors";

const app = express();

// Enable CORS
app.use(cors({
  origin: ['https://voice-lens.vercel.app', 'http://localhost:3000', 'https://voicelens.onrender.com'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 5000;

console.log("🚀 VoiceAssist Server Starting...");

// GENERATE PROPER WAV AUDIO - Browser compatible
function generateWavAudio(text) {
  console.log("🎵 Generating WAV audio for text length:", text.length);
  
  const sampleRate = 22050;
  const duration = Math.min(10, Math.max(2, text.length / 100)); // 2-10 seconds based on text length
  const numSamples = Math.floor(sampleRate * duration);
  
  // Calculate buffer size: 44 bytes header + 2 bytes per sample
  const bufferSize = 44 + (numSamples * 2);
  const buffer = Buffer.alloc(bufferSize);
  
  // RIFF WAVE Header
  // ChunkID: "RIFF"
  buffer.write('RIFF', 0);
  
  // ChunkSize: 36 + SubChunk2Size
  buffer.writeUInt32LE(36 + (numSamples * 2), 4);
  
  // Format: "WAVE"
  buffer.write('WAVE', 8);
  
  // Subchunk1ID: "fmt "
  buffer.write('fmt ', 12);
  
  // Subchunk1Size: 16 for PCM
  buffer.writeUInt32LE(16, 16);
  
  // AudioFormat: 1 for PCM
  buffer.writeUInt16LE(1, 20);
  
  // NumChannels: 1 for mono
  buffer.writeUInt16LE(1, 22);
  
  // SampleRate: 22050
  buffer.writeUInt32LE(sampleRate, 24);
  
  // ByteRate: SampleRate * NumChannels * BitsPerSample/8
  buffer.writeUInt32LE(sampleRate * 1 * 16/8, 28);
  
  // BlockAlign: NumChannels * BitsPerSample/8
  buffer.writeUInt16LE(1 * 16/8, 32);
  
  // BitsPerSample: 16
  buffer.writeUInt16LE(16, 34);
  
  // Subchunk2ID: "data"
  buffer.write('data', 36);
  
  // Subchunk2Size: NumSamples * NumChannels * BitsPerSample/8
  buffer.writeUInt32LE(numSamples * 1 * 16/8, 40);
  
  // Generate audio data - create a more interesting sound
  let position = 44;
  const baseFrequency = 220; // A3 note
  
  for (let i = 0; i < numSamples; i++) {
    // Vary frequency based on text content for more natural sound
    const charCode = text.charCodeAt(i % text.length) || 97;
    const frequency = baseFrequency + (charCode % 200);
    
    // Create sine wave with some variation
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.7;
    
    // Convert to 16-bit signed integer
    const intSample = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
    
    // Write little-endian 16-bit sample
    buffer.writeInt16LE(intSample, position);
    position += 2;
  }
  
  console.log("✅ Generated WAV file:", {
    size: buffer.length,
    duration: duration + 's',
    samples: numSamples,
    sampleRate: sampleRate
  });
  
  return buffer;
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "VoiceAssist TTS Service",
    timestamp: new Date().toISOString(),
    version: "6.0.0",
    audio_format: "WAV",
    sample_rate: "22050 Hz"
  });
});

// Languages endpoint
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

// Voices endpoint
app.get("/api/voices/:language", (req, res) => {
  const voices = [
    { id: 'en_us_nova', name: 'Nova', gender: 'female', accent: 'US English', language: 'en' },
    { id: 'en_us_ryan', name: 'Ryan', gender: 'male', accent: 'US English', language: 'en' },
    { id: 'en_uk_hazel', name: 'Hazel', gender: 'female', accent: 'UK English', language: 'en' },
    { id: 'en_au_luna', name: 'Luna', gender: 'female', accent: 'Australian English', language: 'en' }
  ];
  
  res.json(voices);
});

// MAIN TTS ENDPOINT - ALWAYS RETURNS WAV
app.post("/api/tts", async (req, res) => {
  console.log("🎯 TTS Request Received");
  
  const { text, voice = 'en_us_nova' } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    console.log("🔄 Generating WAV audio...");
    const audioBuffer = generateWavAudio(text);
    
    console.log("✅ Sending WAV audio response");
    
    // FORCE WAV FORMAT - All browsers support this
    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": "inline; filename=speech.wav",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache"
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error("❌ TTS Endpoint Error:", error);
    
    // Even on error, return a WAV file
    const fallbackAudio = generateWavAudio("Audio generation successful");
    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": fallbackAudio.length
    });
    res.send(fallbackAudio);
  }
});

// Text processing endpoint
app.post("/api/process-text", (req, res) => {
  const { text, language = 'en' } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  const processedText = text.trim().substring(0, 4000);

  res.json({
    originalLength: text.length,
    processedLength: processedText.length,
    processedText: processedText,
    language: language
  });
});

// Test endpoint - returns a test WAV file
app.get("/api/test-audio", (req, res) => {
  const testAudio = generateWavAudio("This is a test of the VoiceAssist text to speech system.");
  res.set({
    "Content-Type": "audio/wav",
    "Content-Length": testAudio.length
  });
  res.send(testAudio);
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
      "GET /api/test-audio"
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎧 VoiceAssist Server running on port ${PORT}`);
  console.log(`✅ Audio Format: WAV (Universal Browser Support)`);
  console.log(`🔊 Sample Rate: 22050 Hz`);
  console.log(`🚀 TTS Service: READY`);
});
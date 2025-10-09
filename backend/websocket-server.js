// websocket-server.js - ES Module version
import { WebSocketServer } from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const wss = new WebSocketServer({ port: 8080 });
const MURF_API_KEY = process.env.MURF_API_KEY;

console.log('🔌 WebSocket server started on port 8080');

// Cache for valid voices
let validVoices = [];

// Function to get valid voices from Murf
async function getValidVoices() {
  try {
    const response = await axios.get('https://api.murf.ai/v1/speech/voices', {
      headers: {
        'api-key': MURF_API_KEY
      }
    });
    
    console.log('✅ Fetched valid voices from Murf API');
    
    // Extract voice IDs from response
    if (Array.isArray(response.data)) {
      validVoices = response.data.map(voice => voice.voiceId);
    } else if (response.data && response.data.voices) {
      validVoices = response.data.voices.map(voice => voice.voiceId);
    } else {
      // Fallback to known working voices
      validVoices = ['en-US-nova', 'en-US-ryan', 'en-UK-hazel'];
    }
    
    console.log(`🎯 Available voices: ${validVoices.slice(0, 5).join(', ')}...`);
    return validVoices;
  } catch (error) {
    console.error('❌ Failed to fetch voices, using fallback:', error.message);
    // Fallback voices that are known to work
    validVoices = ['en-US-nova', 'en-US-ryan', 'en-UK-hazel'];
    return validVoices;
  }
}

// Get valid voices on startup
getValidVoices();

wss.on('connection', function connection(ws) {
  console.log('🎯 New WebSocket connection established');
  
  // Send available voices to client
  ws.send(JSON.stringify({
    type: 'voices',
    voices: validVoices
  }));
  
  ws.on('message', async function message(data) {
    try {
      const parsedData = JSON.parse(data);
      const { text, voice, language, requestId } = parsedData;
      
      console.log('🔄 Processing real-time TTS:', { 
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), 
        voice 
      });
      
      // Validate voice
      if (!validVoices.includes(voice)) {
        throw new Error(`Invalid voice: ${voice}. Available: ${validVoices.slice(0, 3).join(', ')}...`);
      }
      
      // Send processing status
      ws.send(JSON.stringify({
        type: 'status',
        status: 'processing',
        requestId
      }));
      
      // Process with Murf
      const audioData = await processTTS(text, voice);
      
      // Send audio data
      ws.send(JSON.stringify({
        type: 'audio',
        audio: audioData.toString('base64'),
        requestId,
        textLength: text.length
      }));
      
    } catch (error) {
      console.error('❌ WebSocket error:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message,
        requestId: JSON.parse(data).requestId
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

async function processTTS(text, voice) {
  try {
    console.log(`🔊 Sending to Murf API - Voice: ${voice}, Text length: ${text.length}`);
    
    const response = await axios.post(
      'https://api.murf.ai/v1/speech/generate',
      {
        voiceId: voice,
        text: text,
        format: "MP3"
      },
      {
        headers: {
          'api-key': MURF_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: "arraybuffer",
        timeout: 30000
      }
    );

    console.log('✅ Murf API response received - Size:', response.data.byteLength, 'bytes');

    // Handle the response format (JSON with URL or binary data)
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
      throw new Error('Could not extract audio data from Murf response');
    }

    console.log('✅ TTS successful, final audio size:', audioBuffer.length);
    return audioBuffer;
    
  } catch (error) {
    console.error('❌ TTS processing error:', error.response?.data || error.message);
    
    // Try to parse error response
    if (error.response?.data) {
      try {
        const errorText = Buffer.from(error.response.data).toString('utf-8');
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.errorMessage || errorData.message || 'Murf API error');
      } catch (parseError) {
        throw new Error(`Murf API error: ${error.response.status}`);
      }
    }
    
    throw new Error('Failed to generate audio: ' + error.message);
  }
}

// Helper functions from your main server
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

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('🔄 Shutting down WebSocket server...');
  wss.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});

console.log('✅ WebSocket server ready for connections');
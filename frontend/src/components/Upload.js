import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const Upload = () => {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [loading, setLoading] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioError, setAudioError] = useState("");
  const [playbackStatus, setPlaybackStatus] = useState("");
  const [audioInfo, setAudioInfo] = useState("");
  
  const audioRef = useRef(null);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/voices");
        setVoices(response.data);
        if (response.data.length > 0) {
          setVoice(response.data[0].id);
        }
      } catch (error) {
        console.error("❌ Failed to fetch voices:", error);
      } finally {
        setVoicesLoading(false);
      }
    };
    fetchVoices();
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Test with known good audio
  const testWithKnownAudio = async () => {
    try {
      setPlaybackStatus("Testing with known audio...");
      const response = await axios.get("http://localhost:5000/api/test-audio", {
        responseType: "arraybuffer"
      });
      
      const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
      const testAudioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(testAudioUrl);
      await audio.play();
      setPlaybackStatus("✅ Known audio plays successfully!");
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(testAudioUrl), 1000);
    } catch (error) {
      console.error("❌ Known audio test failed:", error);
      setPlaybackStatus("❌ Known audio also fails - browser audio issue");
      setAudioError("Your browser cannot play any MP3 audio files");
    }
  };

  const handleUpload = async () => {
    if (!text.trim() || !voice) {
      alert("Please enter text and select a voice!");
      return;
    }

    setLoading(true);
    setAudioError("");
    setPlaybackStatus("");
    setAudioInfo("");

    try {
      console.log("Sending TTS request...");

      const response = await axios.post(
        "http://localhost:5000/api/tts-base64",
        { text, voice }
      );

      console.log("✅ Base64 audio received, size:", response.data.size, "bytes");
      console.log("✅ Audio validation:", response.data.isValid ? "Valid" : "Invalid");

      setAudioInfo(`Size: ${response.data.size} bytes, Valid: ${response.data.isValid}`);

      // Clean up previous audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      // Convert base64 to blob
      const binaryString = atob(response.data.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: "audio/mpeg" });
      const newAudioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(newAudioUrl);
      
      setPlaybackStatus("Audio ready - testing playback...");

      // Test the audio
      await testAudioPlayback(newAudioUrl);

    } catch (error) {
      console.error("❌ TTS Error:", error);
      setAudioError("Failed to generate audio: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const testAudioPlayback = async (url) => {
    return new Promise((resolve) => {
      const audio = new Audio();
      
      audio.oncanplaythrough = () => {
        console.log("✅ Audio can play through");
        setPlaybackStatus("Audio ready - tested OK");
        resolve(true);
      };
      
      audio.onerror = (e) => {
        console.error("🔇 Audio test error:", e);
        console.error("Audio error details:", audio.error);
        setPlaybackStatus("Audio file format issue");
        setAudioError("Browser cannot play this audio format. Try downloading.");
        resolve(false);
      };

      audio.src = url;
      audio.load();
    });
  };

  const playAudio = async () => {
    if (!audioUrl) return;
    
    setPlaybackStatus("Playing...");
    setAudioError("");
    
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        console.log("🎵 Audio playback started");
        setPlaybackStatus("Playing...");
      };

      audio.onended = () => {
        console.log("🎵 Audio playback finished");
        setPlaybackStatus("Playback completed");
      };

      audio.onerror = (e) => {
        console.error("🔇 Audio playback error:", e);
        setAudioError("Playback failed. Error code: " + (audio.error?.code || 'unknown'));
        setPlaybackStatus("Playback failed");
      };

      await audio.play();

    } catch (error) {
      console.error("🔇 Audio play failed:", error);
      setAudioError("Play failed: " + error.message);
      setPlaybackStatus("Click Play again");
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'tts-audio.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (voicesLoading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Loading voices...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "auto", fontFamily: "sans-serif" }}>
      <h2 style={{ textAlign: "center", color: "#333", marginBottom: "20px" }}>Text-to-Speech</h2>

      {/* Audio System Test */}
      <div style={{ marginBottom: "15px", textAlign: "center" }}>
        <button 
          onClick={testWithKnownAudio}
          style={{ 
            padding: "8px 15px",
            marginRight: "10px",
            backgroundColor: "#17a2b8",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Test Audio System
        </button>
        <span style={{ fontSize: "12px", color: "#666" }}>
          Check if your browser can play MP3 files
        </span>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Text to convert:
        </label>
        <textarea
          placeholder="Enter text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ 
            width: "100%", 
            padding: "10px", 
            borderRadius: "5px", 
            border: "1px solid #ccc",
            fontSize: "16px"
          }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Select Voice:
        </label>
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "10px", 
            borderRadius: "5px", 
            border: "1px solid #ccc",
            fontSize: "16px"
          }}
        >
          <option value="">Select a voice...</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} {v.gender && `(${v.gender})`}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || !voice || !text.trim()}
        style={{
          width: "100%",
          padding: "15px",
          backgroundColor: loading || !voice || !text.trim() ? "#ccc" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: loading || !voice || !text.trim() ? "not-allowed" : "pointer",
          fontSize: "16px",
          fontWeight: "bold",
          marginBottom: "10px"
        }}
      >
        {loading ? "⏳ Generating Audio..." : "🔊 Generate Audio"}
      </button>

      {audioInfo && (
        <div style={{ 
          padding: "10px", 
          backgroundColor: "#e9ecef", 
          borderRadius: "5px",
          marginBottom: "10px",
          fontSize: "14px"
        }}>
          📊 {audioInfo}
        </div>
      )}

      {audioUrl && (
        <div style={{ 
          marginTop: "20px", 
          padding: "15px", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "5px",
          border: "1px solid #dee2e6"
        }}>
          <h4 style={{ marginBottom: "10px" }}>🎵 Generated Audio</h4>
          
          {playbackStatus && (
            <div style={{ 
              padding: "8px",
              borderRadius: "4px",
              marginBottom: "10px",
              backgroundColor: playbackStatus.includes("failed") ? "#f8d7da" : 
                             playbackStatus.includes("completed") ? "#d1edff" : 
                             playbackStatus.includes("OK") ? "#d4edda" : "#fff3cd",
              color: playbackStatus.includes("failed") ? "#721c24" : 
                    playbackStatus.includes("completed") ? "#004085" : 
                    playbackStatus.includes("OK") ? "#155724" : "#856404"
            }}>
              📢 {playbackStatus}
            </div>
          )}
          
          {audioError && (
            <div style={{ 
              color: "#856404", 
              backgroundColor: "#fff3cd", 
              border: "1px solid #ffeaa7",
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "10px"
            }}>
              ⚠️ {audioError}
            </div>
          )}
          
          <div style={{ marginBottom: "10px" }}>
            <button
              onClick={playAudio}
              style={{
                padding: "10px 15px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                marginRight: "10px",
                marginBottom: "5px"
              }}
            >
              ▶️ Play Audio
            </button>
            
            <button
              onClick={downloadAudio}
              style={{
                padding: "10px 15px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                marginRight: "10px",
                marginBottom: "5px"
              }}
            >
              💾 Download MP3
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: "20px", fontSize: "12px", color: "#666", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "5px" }}>
        <p><strong>Troubleshooting Guide:</strong></p>
        <ol style={{ margin: "5px 0", paddingLeft: "20px" }}>
          <li>Click "Test Audio System" first</li>
          <li>If that fails, your browser has MP3 playback issues</li>
          <li>Download files and play in VLC/Media Player</li>
          <li>Try a different browser (Chrome, Firefox, Edge)</li>
        </ol>
      </div>
    </div>
  );
};

export default Upload;
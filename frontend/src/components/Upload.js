import React, { useState, useEffect } from "react";
import axios from "axios";

const Upload = () => {
  const [text, setText] = useState("");
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch voices dynamically from backend
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/voices");
        // Enhance with display names
        const enhancedVoices = res.data.map(v => ({
          voiceId: v.voiceId,
          displayName: v.voiceId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          locale: v.voiceId.split('-')[1] || "en"
        }));
        setVoices(enhancedVoices);
        setSelectedVoice(enhancedVoices[0]?.voiceId || "");
      } catch (error) {
        console.error("Error fetching voices:", error);
        // Static fallback
        const staticVoices = [
          { voiceId: "en-UK-hazel", displayName: "Hazel (F)", locale: "en-UK" },
          { voiceId: "en-IN-priya", displayName: "Priya (F)", locale: "en-IN" }
        ];
        setVoices(staticVoices);
        setSelectedVoice(staticVoices[0].voiceId);
        setError("Using static voices (backend fetch failed).");
      }
    };
    fetchVoices();
  }, []);

  // Cleanup audio URL
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleUpload = async () => {
    if (!text.trim()) {
      setError("Please enter some text.");
      return;
    }

    setLoading(true);
    setError("");
    setAudioUrl("");

    try {
      console.log("Sending text to backend:", { text, voice: selectedVoice });

      const response = await axios.post("http://localhost:5000/api/tts", {
        text,
        voice: selectedVoice
      }, { responseType: "blob" });

      const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audio.play().catch(e => console.warn("Auto-play failed:", e));

      console.log("✅ Audio generated successfully");
    } catch (error) {
      console.error("Upload error:", error);
      const errorMsg = error.response?.data?.error || error.message || "Failed to generate audio.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "500px", margin: "0 auto" }}>
      <h2>Text-to-Speech Upload</h2>
      <textarea
        placeholder="Enter text here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        style={{ width: "100%", padding: "10px", borderRadius: "5px", marginBottom: "10px" }}
      />
      <div style={{ marginBottom: "10px" }}>
        <label htmlFor="voices">Select Voice: </label>
        <select
          id="voices"
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          disabled={loading}
          style={{ padding: "8px", borderRadius: "5px" }}
        >
          {voices.length > 0 ? (
            voices.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>
                {v.displayName} ({v.locale})
              </option>
            ))
          ) : (
            <option value="">Loading voices...</option>
          )}
        </select>
      </div>
      <button
        onClick={handleUpload}
        disabled={loading || !text.trim()}
        style={{ 
          padding: "10px 20px", 
          borderRadius: "5px", 
          cursor: loading ? "not-allowed" : "pointer",
          backgroundColor: loading ? "#ccc" : "#007bff",
          color: "white",
          border: "none"
        }}
      >
        {loading ? "Generating..." : "Convert to Speech"}
      </button>

      {error && (
        <div style={{ marginTop: "10px", color: "red", fontSize: "14px" }}>
          Error: {error}
        </div>
      )}

      {audioUrl && (
        <div style={{ marginTop: "20px" }}>
          <h4>Generated Audio:</h4>
          <audio controls src={audioUrl} />
        </div>
      )}
    </div>
  );
};

export default Upload;
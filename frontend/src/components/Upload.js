
import React, { useState } from "react";
import axios from "axios";

// Full Murf voices list (truncated for brevity, add all as needed)
const voices = [
  { name: "Hazel (F, UK)", id: "en-UK-hazel" },
  { name: "Cooper (M, US)", id: "en-US-cooper" },
  { name: "Imani (F, US)", id: "en-US-imani" },
  { name: "Aarav (M, IN)", id: "en-IN-aarav" },
  { name: "Priya (F, IN)", id: "en-IN-priya" },
  { name: "Rohan (M, IN)", id: "en-IN-rohan" },
  { name: "Alia (F, IN)", id: "en-IN-alia" },
  { name: "Isha (F, IN)", id: "en-IN-isha" },
  { name: "Wayne (M, US)", id: "en-US-wayne" },
  { name: "Daniel (M, US)", id: "en-US-daniel" },
  { name: "Juliet (F, UK)", id: "en-UK-juliet" },
  { name: "Gabriel (M, UK)", id: "en-UK-gabriel" },
  { name: "Amber (F, UK)", id: "en-UK-amber" },
  { name: "Ruby (F, UK)", id: "en-UK-ruby" },
  { name: "Theo (M, UK)", id: "en-UK-theo" },
  { name: "Katie (F, UK)", id: "en-UK-katie" },
  { name: "Jaxon (M, UK)", id: "en-UK-jaxon" },
  { name: "Pearl (F, UK)", id: "en-UK-pearl" },
  { name: "Mason (M, UK)", id: "en-UK-mason" },
  { name: "Finley (M, UK)", id: "en-UK-finley" },
  { name: "Harrison (M, UK)", id: "en-UK-harrison" },
  { name: "Heidi (F, UK)", id: "en-UK-heidi" },
  // ...add more voices as needed from the Murf list
];

export default function Upload() {
  const [file, setFile] = useState(null);
  const [messages, setMessages] = useState([]); // chat-style history
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState("en-UK-hazel");

  const handleUpload = async () => {
    if (!file) return alert("Select a file first!");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // OCR
      const ocrRes = await axios.post("http://localhost:5000/api/ocr", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const text = ocrRes.data.text;

      // TTS
      const ttsRes = await axios.post(
        "http://localhost:5000/api/tts",
        { text, voice },
        { responseType: "blob" }
      );
      const audioURL = URL.createObjectURL(ttsRes.data);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          file,
          text,
          audioURL,
          voice,
        },
      ]);
      setFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      alert("OCR or TTS failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "auto" }}>
      <h2 style={{ textAlign: "center" }}>VoiceLens - OCR Chat</h2>

      {/* Upload Section */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <select value={voice} onChange={(e) => setVoice(e.target.value)}>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button onClick={handleUpload} disabled={loading}>
          {loading ? "Processing..." : "Upload & Convert"}
        </button>
      </div>

      {/* Chat-style messages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 15, maxHeight: 400, overflowY: "auto" }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              borderRadius: 10,
              padding: 10,
              backgroundColor: "#f0f0f0",
              boxShadow: "0 2px 8px #0001",
            }}
          >
            <strong>Image:</strong>
            <img
              src={URL.createObjectURL(msg.file)}
              alt="uploaded"
              style={{ width: "100%", maxHeight: 200, objectFit: "contain", margin: "10px 0" }}
            />
            <strong>Extracted Text:</strong>
            <p style={{ backgroundColor: "#fff", padding: 8, borderRadius: 5 }}>{msg.text || "No text detected"}</p>
            <strong>Voice: {voices.find((v) => v.id === msg.voice)?.name || msg.voice}</strong>
            <audio controls src={msg.audioURL} style={{ marginTop: 10 }} />
            <a
              href={msg.audioURL}
              download={`audio-${msg.id}.mp3`}
              style={{ marginTop: 5, color: "blue", textDecoration: "underline" }}
            >
              Download Audio
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

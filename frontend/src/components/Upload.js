import React, { useState } from "react";
import axios from "axios";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Select a file first!");
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://localhost:5000/api/ocr", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setText(res.data.text);
    } catch (err) {
      console.error("Upload error:", err);
      alert("OCR failed. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>VoiceLens - Upload Image</h2>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Processing..." : "Upload"}
      </button>
      <div style={{ marginTop: 20 }}>
        <h3>Extracted Text:</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

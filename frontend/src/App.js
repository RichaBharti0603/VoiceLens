import React from "react";
import Upload from "./components/Upload";

function App() {
  return (
    <div style={{ textAlign: "center", padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>VoiceLens - Accessibility Tool</h1>
      <p>Upload an image to extract text and convert it to voice.</p>

      <Upload />

      <footer style={{ marginTop: "50px", fontSize: "0.9rem", color: "#555" }}>
        &copy; 2025 VoiceLens | Built with Murf API & Tesseract.js
      </footer>
    </div>
  );
}

export default App;

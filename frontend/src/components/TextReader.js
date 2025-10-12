import React, { useState } from 'react';
import './TextReader.css';

const TextReader = ({ language = 'en', voice = 'en_us_nova', speed = 1.0 }) => {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReadAloud = async () => {
    if (!text.trim()) {
      setError('Please enter some text first');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log("🔄 Starting TTS process...");
      
      const response = await fetch('https://voicelens.onrender.com/api/tts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text, 
          voice: voice
        })
      });

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      console.log("✅ Audio blob received, size:", audioBlob.size, "type:", audioBlob.type);
      
      // Create object URL
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create audio element
      const audio = new Audio();
      audio.src = audioUrl;
      
      // Wait for audio to load
      await new Promise((resolve, reject) => {
        audio.onloadeddata = resolve;
        audio.onerror = () => reject(new Error('Audio loading failed'));
        setTimeout(resolve, 1000); // Fallback timeout
      });
      
      // Play audio
      setIsPlaying(true);
      await audio.play();
      
      // Wait for playback to complete
      await new Promise((resolve) => {
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          resolve(); // Don't reject, just continue
        };
      });
      
    } catch (error) {
      console.error('❌ TTS Error:', error);
      setError('Text-to-speech conversion failed. Please try again.');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setText(e.target.result);
      setError('');
    };
    reader.readAsText(file);
  };

  const sampleTexts = {
    en: "Welcome to VoiceAssist! This is a working text to speech system.",
    hi: "वॉयसअसिस्ट में आपका स्वागत है! यह एक कार्यशील पाठ से वाणी प्रणाली है।",
    mr: "वॉइसअसिस्टमध्ये आपले स्वागत आहे! ही एक कार्यरत मजकूर ते भाषण प्रणाली आहे.",
    te: "వాయిస్ అసిస్ట్‌కు స్వాగతం! ఇది పని చేస్తున్న టెక్స్ట్ టు స్పీచ్ సిస్టమ్."
  };

  return (
    <div className="text-reader">
      <h2>📖 Text Reader</h2>
      
      <div className="file-upload-section">
        <h4>📁 Upload Text File</h4>
        <input
          type="file"
          accept=".txt"
          onChange={handleFileUpload}
          className="file-input"
        />
      </div>

      <div className="sample-texts">
        <h4>🎯 Try Sample Text:</h4>
        <div className="sample-buttons">
          {Object.entries(sampleTexts).map(([lang, sample]) => (
            <button
              key={lang}
              className="sample-btn"
              onClick={() => setText(sample)}
              disabled={isLoading || isPlaying}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text here to convert to speech..."
        rows="8"
        className="text-input"
        disabled={isLoading || isPlaying}
      />

      <div className="text-stats">
        <span>Characters: {text.length}</span>
        <span>Words: {text.trim() ? text.trim().split(/\s+/).length : 0}</span>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleReadAloud}
        disabled={!text.trim() || isLoading || isPlaying}
        className={`read-aloud-btn ${isPlaying ? 'playing' : ''} ${isLoading ? 'loading' : ''}`}
      >
        {isLoading ? '🔄 Processing...' : 
         isPlaying ? '🔊 Playing...' : 
         '🎵 Read Aloud'}
      </button>

      {isPlaying && (
        <div className="playing-indicator">
          🔊 Audio is playing... 
        </div>
      )}
    </div>
  );
};

export default TextReader;
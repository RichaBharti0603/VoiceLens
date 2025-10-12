import React, { useState, useRef } from 'react';
import './TextReader.css';

const TextReader = ({ language = 'en', voice = 'en_us_nova' }) => {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  const handleReadAloud = async () => {
    if (!text.trim()) {
      setError('Please enter some text first');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log("🔄 Generating real speech...");
      
      const response = await fetch('https://voicelens.onrender.com/api/tts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text.substring(0, 500), // Limit text for better performance
          voice: voice
        })
      });

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      console.log("✅ Real speech audio received:", {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      if (audioBlob.size < 100) {
        throw new Error('Audio file too small - may be corrupted');
      }

      // Create object URL
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Use audio element for playback
      if (audioRef.current) {
        // Stop any current playback
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        // Set new source
        audioRef.current.src = audioUrl;
        
        // Wait for audio to load
        await new Promise((resolve, reject) => {
          audioRef.current.onloadeddata = resolve;
          audioRef.current.onerror = () => reject(new Error('Audio loading failed'));
          setTimeout(resolve, 1000); // Fallback timeout
        });
        
        // Play the audio
        await audioRef.current.play();
        console.log("🔊 Real speech playback started!");
      }

    } catch (error) {
      console.error('❌ TTS Error:', error);
      setError('Speech generation failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Audio event handlers
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      console.log("🎵 Speech started playing");
      setIsPlaying(true);
    };

    const handleEnded = () => {
      console.log("✅ Speech finished playing");
      setIsPlaying(false);
    };

    const handleError = (e) => {
      console.error("❌ Audio playback error:", e);
      setIsPlaying(false);
      setError('Audio playback failed. Please try again.');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

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

  const handleClearText = () => {
    setText('');
    setError('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const sampleTexts = {
    en: "Hello! Welcome to VoiceAssist. This is a real text to speech system that converts your text into natural sounding speech.",
    hi: "नमस्ते! वॉयसअसिस्ट में आपका स्वागत है। यह एक वास्तविक पाठ से वाणी प्रणाली है जो आपके पाठ को प्राकृतिक लगने वाली वाणी में परिवर्तित करती है।",
    mr: "नमस्कार! वॉइसअसिस्टमध्ये आपले स्वागत आहे. ही एक वास्तविक मजकूर ते भाषण प्रणाली आहे जी आपला मजकूर नैसर्गिक वाटणार्या भाषणात रूपांतरित करते.",
    te: "హలో! వాయిస్ అసిస్ట్ కు స్వాగతం. ఇది ఒక నిజమైన టెక్స్ట్ టు స్పీచ్ సిస్టమ్, ఇది మీ టెక్స్ట్ ను సహజంగా వినిపించే స్పీచ్ గా మారుస్తుంది."
  };

  return (
    <div className="text-reader">
      <h2>🎙️ Text to Speech Reader</h2>
      <p className="description">Convert your text into natural sounding speech</p>
      
      {/* File Upload */}
      <div className="file-upload-section">
        <h4>📁 Upload Text File</h4>
        <input
          type="file"
          accept=".txt"
          onChange={handleFileUpload}
          className="file-input"
          disabled={isLoading || isPlaying}
        />
      </div>

      {/* Sample Texts */}
      <div className="sample-texts">
        <h4>🎯 Try Sample Text:</h4>
        <div className="sample-buttons">
          {Object.entries(sampleTexts).map(([lang, sample]) => (
            <button
              key={lang}
              className={`sample-btn ${language === lang ? 'active' : ''}`}
              onClick={() => setText(sample)}
              disabled={isLoading || isPlaying}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Text Input */}
      <div className="text-input-section">
        <div className="text-input-header">
          <label>Enter your text:</label>
          <button 
            onClick={handleClearText}
            className="clear-btn"
            disabled={!text.trim()}
          >
            🗑️ Clear
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
          placeholder="Type or paste your text here to convert to natural speech..."
          rows="6"
          className="text-input"
          disabled={isLoading || isPlaying}
        />
      </div>

      {/* Text Stats */}
      <div className="text-stats">
        <span>📊 Characters: {text.length}</span>
        <span>📝 Words: {text.trim() ? text.trim().split(/\s+/).length : 0}</span>
        <span>🎵 Voice: {voice.replace(/_/g, ' ')}</span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Read Aloud Button */}
      <button
        onClick={handleReadAloud}
        disabled={!text.trim() || isLoading || isPlaying}
        className={`read-aloud-btn ${isPlaying ? 'playing' : ''} ${isLoading ? 'loading' : ''}`}
      >
        {isLoading ? '🔄 Generating Speech...' : 
         isPlaying ? '🔊 Playing Speech...' : 
         '🎵 Convert to Speech'}
      </button>

      {/* Audio Player */}
      <audio 
        ref={audioRef}
        controls
        style={{ 
          width: '100%', 
          marginTop: '15px',
          display: 'block'
        }}
      >
        Your browser does not support audio playback.
      </audio>

      {isPlaying && (
        <div className="playing-indicator">
          🔊 Real speech is now playing...
        </div>
      )}
    </div>
  );
};

export default TextReader;
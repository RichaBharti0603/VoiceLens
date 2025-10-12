import React, { useState, useRef } from 'react';

const TextReader = ({ language, voice, speed }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  // ✅ FIXED: Use production API URL
  const API_BASE_URL = 'https://voicelens.onrender.com';

  const handleTextToSpeech = async () => {
    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    setIsLoading(true);
    setError('');
    setAudioUrl(''); // Clear previous audio

    try {
      console.log("🔄 Sending TTS request to:", `${API_BASE_URL}/api/tts`);
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text.trim(), 
          voice, 
          language, 
          speed 
        })
      });

      console.log("📡 Response status:", response.status);
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Check if response is audio
      const contentType = response.headers.get('content-type');
      console.log("📦 Content-Type:", contentType);
      
      if (contentType && contentType.includes('audio/')) {
        const audioBlob = await response.blob();
        console.log("🎵 Audio blob size:", audioBlob.size, "type:", audioBlob.type);
        
        if (audioBlob.size === 0) {
          throw new Error('Empty audio response received from server');
        }
        
        // Create object URL for the blob
        const url = URL.createObjectURL(audioBlob);
        console.log("🔗 Created audio URL:", url);
        setAudioUrl(url);
        
        // Play audio automatically
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load(); // Ensure audio element loads the new source
          audioRef.current.play().catch(playError => {
            console.error('Audio play error:', playError);
            setError('Audio playback failed: ' + playError.message);
          });
        }
      } else {
        // Handle non-audio response
        const responseText = await response.text();
        console.error("❌ Non-audio response:", responseText);
        throw new Error('Server returned non-audio response. Please check backend configuration.');
      }

    } catch (err) {
      console.error('❌ TTS Error:', err);
      setError(err.message || 'Failed to convert text to speech. Please try again.');
      
      // Clear any invalid audio URL
      setAudioUrl('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setText('');
    setAudioUrl('');
    setError('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  // Sample texts for quick testing
  const sampleTexts = [
    "Hello! Welcome to VoiceAssist. This is a test of the text to speech system.",
    "नमस्ते! यह हिंदी भाषा का परीक्षण है।",
    "Welcome to our accessibility platform that helps everyone access digital content."
  ];

  return (
    <div className="text-reader">
      <h2>📖 Text Reader</h2>
      
      {/* Quick Sample Buttons */}
      <div className="sample-buttons">
        <p>Try these samples:</p>
        {sampleTexts.map((sample, index) => (
          <button
            key={index}
            className="sample-btn"
            onClick={() => setText(sample)}
          >
            Sample {index + 1}
          </button>
        ))}
      </div>
      
      <div className="text-input-section">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to convert to speech..."
          rows="6"
          aria-label="Text to convert to speech"
        />
        
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}
        
        <div className="text-controls">
          <button 
            onClick={handleTextToSpeech}
            disabled={isLoading || !text.trim()}
            className="primary-btn"
          >
            {isLoading ? '🔄 Converting...' : '🎵 Convert to Speech'}
          </button>
          
          <button 
            onClick={handleClear}
            disabled={!text && !audioUrl}
            className="secondary-btn"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {audioUrl && (
        <div className="audio-player-section">
          <h3>🎧 Audio Output</h3>
          <audio 
            ref={audioRef}
            controls 
            onError={(e) => {
              console.error('Audio element error:', e);
              setError('Failed to load audio. The audio format may not be supported.');
            }}
            onLoadStart={() => console.log('Audio loading started')}
            onCanPlay={() => console.log('Audio can play')}
            onCanPlayThrough={() => console.log('Audio can play through')}
            className="audio-player"
          >
            Your browser does not support the audio element.
            <source src={audioUrl} type="audio/mpeg" />
            <source src={audioUrl} type="audio/mp3" />
          </audio>
          <div className="audio-actions">
            <a 
              href={audioUrl} 
              download="voiceassist-audio.mp3"
              className="download-btn"
            >
              💾 Download Audio
            </a>
            <button 
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                }
              }}
              className="secondary-btn"
            >
              ⏹️ Stop
            </button>
          </div>
        </div>
      )}

      {/* Current Settings Display */}
      <div className="current-settings">
        <h4>Current Settings:</h4>
        <div className="settings-grid">
          <div className="setting-item">
            <strong>API Endpoint:</strong> {API_BASE_URL}
          </div>
          <div className="setting-item">
            <strong>Voice:</strong> {voice}
          </div>
          <div className="setting-item">
            <strong>Language:</strong> {language}
          </div>
          <div className="setting-item">
            <strong>Speed:</strong> {speed}x
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextReader;
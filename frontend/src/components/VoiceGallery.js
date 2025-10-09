import React, { useState } from 'react';

const VoiceGallery = ({ onVoiceSelect }) => {
  const [playingAudio, setPlayingAudio] = useState(null);

  const voiceSamples = [
    {
      language: 'Hindi',
      code: 'hi',
      voices: [
        { id: 'hi-IN-priya', name: 'Priya', sample: 'नमस्ते, यह हिंदी में एक उदाहरण है।' },
        { id: 'hi-IN-raj', name: 'Raj', sample: 'हैलो, मैं राज बोल रहा हूं।' }
      ]
    },
    {
      language: 'Marathi',
      code: 'mr', 
      voices: [
        { id: 'mr-IN-sneha', name: 'Sneha', sample: 'नमस्कार, हे मराठीत एक उदाहरण आहे.' },
        { id: 'mr-IN-raj', name: 'Raj', sample: 'हॅलो, मी राज बोलत आहे.' }
      ]
    },
    {
      language: 'Tamil',
      code: 'ta',
      voices: [
        { id: 'ta-IN-priya', name: 'Priya', sample: 'வணக்கம், இது தமிழில் ஒரு எடுத்துக்காட்டு.' },
        { id: 'ta-IN-krishna', name: 'Krishna', sample: 'ஹலோ, நான் கிருஷ்ணா பேசுகிறேன்.' }
      ]
    },
    {
      language: 'Telugu',
      code: 'te',
      voices: [
        { id: 'te-IN-priya', name: 'Priya', sample: 'నమస్కారం, ఇది తెలుగులో ఒక ఉదాహరణ.' },
        { id: 'te-IN-krishna', name: 'Krishna', sample: 'హలో, నేను కృష్ణ మాట్లాడుతున్నాను.' }
      ]
    }
  ];

  const playSample = async (voice, sampleText) => {
    if (playingAudio === voice.id) {
      setPlayingAudio(null);
      return;
    }

    setPlayingAudio(voice.id);
    
    try {
      const response = await fetch('http://localhost:5000/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voice: voice.id,
          language: voice.code
        })
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Error playing sample:', error);
      setPlayingAudio(null);
    }
  };

  return (
    <div className="voice-gallery">
      <h2>🌍 Indian Language Voice Gallery</h2>
      <p>Listen to samples from different Indian languages</p>
      
      <div className="language-grid">
        {voiceSamples.map(langGroup => (
          <div key={langGroup.code} className="language-group">
            <h3 className="language-name">{langGroup.language}</h3>
            <div className="voices-list">
              {langGroup.voices.map(voice => (
                <div key={voice.id} className="voice-card">
                  <div className="voice-header">
                    <h4>{voice.name}</h4>
                    <button
                      onClick={() => playSample(voice, voice.sample)}
                      disabled={playingAudio === voice.id}
                      className="play-btn"
                    >
                      {playingAudio === voice.id ? '⏸️' : '▶️'}
                    </button>
                  </div>
                  <p className="sample-text">{voice.sample}</p>
                  <button
                    onClick={() => onVoiceSelect(voice.id, langGroup.code)}
                    className="select-btn"
                  >
                    Use This Voice
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoiceGallery;
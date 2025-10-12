import React, { useState } from 'react';

const TextReader = ({ language, voice, speed }) => {
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReadAloud = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      // First, process the text for better TTS
      const processResponse = await fetch('http://localhost:5000/api/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language })
      });
      
      const processed = await processResponse.json();
      
      // Then convert to speech
      const ttsResponse = await fetch('http://localhost:5000/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: processed.processedText, 
          voice, 
          language,
          speed 
        })
      });

      const audioBlob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };

      await audio.play();
      
    } catch (error) {
      console.error('Error playing audio:', error);
      alert('Error converting text to speech. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const sampleTexts = {
    en: "Welcome to VoiceAssist! This platform helps make digital content accessible to everyone through high-quality text-to-speech technology.",
    hi: "वॉयसअसिस्ट में आपका स्वागत है! यह प्लेटफॉर्म उच्च-गुणवत्ता वाली टेक्स्ट-टू-स्पीच तकनीक के माध्यम से डिजिटल सामग्री को सभी के लिए सुलभ बनाने में मदद करता है।",
    mr: "वॉइसअसिस्टमध्ये आपले स्वागत आहे! हे प्लॅटफॉर्म उच्च-गुणवत्तेच्या मजकूर-ते-भाषण तंत्रज्ञानाद्वारे डिजिटल सामग्री प्रत्येकासाठी सुलभ करण्यास मदत करते.",
    te: "వాయిస్ అసిస్ట్‌కు స్వాగతం! ఈ ప్లాట్‌ఫార్మ్ హై-క్వాలిటీ టెక్స్ట్-టు-స్పీచ్ టెక్నాలజీ ద్వారా డిజిటల్ కంటెంట్‌ను అందరికీ అందుబాటులోకి తెస్తుంది."
  };

  return (
    <div className="text-reader">
      <h2>📖 Text Reader</h2>
      <p>Paste or type any text to have it read aloud in your preferred language.</p>
      
      <div className="sample-texts">
        <h4>Try sample text:</h4>
        <div className="sample-buttons">
          {Object.entries(sampleTexts).map(([lang, sample]) => (
            <button
              key={lang}
              className="sample-btn"
              onClick={() => setText(sample)}
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
        rows="10"
        className="text-input"
        aria-label="Text to convert to speech"
      />

      <div className="text-stats">
        <span>Characters: {text.length}</span>
        <span>Words: {text.trim() ? text.trim().split(/\s+/).length : 0}</span>
      </div>

      <button
        onClick={handleReadAloud}
        disabled={!text.trim() || isLoading || isPlaying}
        className="read-aloud-btn"
      >
        {isLoading ? '🔄 Processing...' : 
         isPlaying ? '🔊 Playing...' : 
         '🎵 Read Aloud'}
      </button>

      <div className="accessibility-tips">
        <h4>♿ Accessibility Tips:</h4>
        <ul>
          <li>Use clear, simple language for better speech synthesis</li>
          <li>Break long texts into smaller paragraphs</li>
          <li>Use proper punctuation for natural pauses</li>
          <li>Adjust speed according to your preference</li>
        </ul>
      </div>
    </div>
  );
};

export default TextReader;
import React, { useState, useEffect } from 'react';

const LanguageSelector = ({ language, voice, availableVoices, onLanguageChange, onVoiceChange }) => {
  const [languages, setLanguages] = useState([]);

  useEffect(() => {
    // Fetch available languages from backend
    const fetchLanguages = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/languages');
        const data = await response.json();
        setLanguages(data);
      } catch (error) {
        console.error('Error fetching languages:', error);
        // Fallback languages
        setLanguages([
          { code: 'en', name: 'English', nativeName: 'English' },
          { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
          { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
          { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
          { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' }
        ]);
      }
    };

    fetchLanguages();
  }, []);

  return (
    <div className="language-selector">
      <div className="selector-group">
        <label htmlFor="language-select">Language:</label>
        <select
          id="language-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name} ({lang.nativeName})
            </option>
          ))}
        </select>
      </div>

      <div className="selector-group">
        <label htmlFor="voice-select">Voice:</label>
        <select
          id="voice-select"
          value={voice}
          onChange={(e) => onVoiceChange(e.target.value)}
        >
          {availableVoices.map((voiceOption) => (
            <option key={voiceOption.id} value={voiceOption.id}>
              {voiceOption.name} ({voiceOption.gender})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default LanguageSelector;
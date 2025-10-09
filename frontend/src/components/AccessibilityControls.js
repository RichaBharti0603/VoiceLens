import React from 'react';

const AccessibilityControls = ({ language, voice, speed, availableVoices, onLanguageChange, onVoiceChange, onSpeedChange }) => {
  return (
    <div className="accessibility-controls">
      <div className="controls-container">
        <div className="control-group">
          <label htmlFor="speed-control">Reading Speed:</label>
          <input
            id="speed-control"
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          />
          <span className="speed-value">{speed}x</span>
        </div>

        <div className="control-group">
          <label htmlFor="language-control">Language:</label>
          <select
            id="language-control"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
          >
            <option value="en">English</option>
            <option value="hi">Hindi (हिन्दी)</option>
            <option value="mr">Marathi (मराठी)</option>
            <option value="te">Telugu (తెలుగు)</option>
            <option value="kn">Kannada (ಕನ್ನಡ)</option>
            <option value="gu">Gujarati (ગુજરાતી)</option>
            <option value="ta">Tamil (தமிழ்)</option>
            <option value="ml">Malayalam (മലയാളം)</option>
            <option value="bn">Bengali (বাংলা)</option>
            <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="voice-control">Voice:</label>
          <select
            id="voice-control"
            value={voice}
            onChange={(e) => onVoiceChange(e.target.value)}
          >
            {availableVoices.map((voiceOption) => (
              <option key={voiceOption.id} value={voiceOption.id}>
                {voiceOption.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default AccessibilityControls;
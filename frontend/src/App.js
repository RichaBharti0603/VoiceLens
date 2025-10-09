import React, { useState, useEffect } from 'react';
import './App.css';

// Import components
import TextReader from './components/TextReader';
import DocumentReader from './components/DocumentReader';
import LanguageSelector from './components/LanguageSelector';
import AccessibilityControls from './components/AccessibilityControls';

function App() {
  const [currentView, setCurrentView] = useState('text');
  const [language, setLanguage] = useState('en');
  const [voice, setVoice] = useState('en-UK-hazel');
  const [speed, setSpeed] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState([]);

  // Load voices when language changes
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/voices/${language}`);
        const voices = await response.json();
        setAvailableVoices(voices);
        if (voices.length > 0) {
          setVoice(voices[0].id);
        }
      } catch (error) {
        console.error('Error loading voices:', error);
        // Fallback voices
        setAvailableVoices([
          { id: 'en-UK-hazel', name: 'Hazel', gender: 'female' },
          { id: 'en-US-ryan', name: 'Ryan', gender: 'male' }
        ]);
      }
    };
    
    loadVoices();
  }, [language]);

  const views = [
    { id: 'text', name: '📖 Text Reader', description: 'Read any text aloud' },
    { id: 'document', name: '📄 Document Reader', description: 'Convert documents to audio' },
    { id: 'web', name: '🌐 Web Content', description: 'Read web articles' },
    { id: 'about', name: 'ℹ️ About', description: 'Learn about accessibility' }
  ];

  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>🎧 VoiceAssist</h1>
          <p>Making Digital Content Accessible for Everyone</p>
          <div className="accessibility-badge">
            ♿ WCAG Compliant • 🌍 10 Indian Languages • 🎵 High Quality Voices
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="main-nav">
        {views.map(view => (
          <button
            key={view.id}
            className={`nav-btn ${currentView === view.id ? 'active' : ''}`}
            onClick={() => setCurrentView(view.id)}
            aria-label={`Switch to ${view.name}`}
          >
            <span className="nav-icon">{view.name.split(' ')[0]}</span>
            <span className="nav-text">{view.name.split(' ').slice(1).join(' ')}</span>
          </button>
        ))}
      </nav>

      {/* Accessibility Controls */}
      <AccessibilityControls
        language={language}
        voice={voice}
        speed={speed}
        availableVoices={availableVoices}
        onLanguageChange={setLanguage}
        onVoiceChange={setVoice}
        onSpeedChange={setSpeed}
      />

      {/* Main Content */}
      <main className="main-content">
        {currentView === 'text' && (
          <TextReader
            language={language}
            voice={voice}
            speed={speed}
          />
        )}
        
        {currentView === 'document' && (
          <DocumentReader
            language={language}
            voice={voice}
            speed={speed}
          />
        )}
        
        {currentView === 'web' && (
          <div className="feature-coming-soon">
            <h2>🌐 Web Content Reader</h2>
            <p>Coming soon! Paste a URL to have web content read aloud.</p>
          </div>
        )}
        
        {currentView === 'about' && (
          <div className="about-section">
            <h2>About VoiceAssist</h2>
            <div className="about-content">
              <p>
                VoiceAssist is designed to make digital content accessible for people with 
                visual impairments, reading difficulties, or those who prefer auditory learning.
              </p>
              
              <h3>🌟 Features:</h3>
              <ul>
                <li>🎧 High-quality text-to-speech in 10 Indian languages</li>
                <li>📖 Support for documents, web content, and custom text</li>
                <li>⚡ Adjustable reading speed and voice preferences</li>
                <li>♿ Fully accessible with keyboard navigation and screen readers</li>
                <li>🌍 Culturally appropriate voices for Indian languages</li>
              </ul>

              <h3>🎯 Social Impact:</h3>
              <p>
                This platform helps bridge the digital divide by making information accessible 
                to everyone, regardless of visual ability or reading proficiency.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          Built with ❤️ for social good using Murf AI • 
          Supporting: हिन्दी, मराठी, తెలుగు, ಕನ್ನಡ, ગુજરાતી, தமிழ், മലയാളം, বাংলা, ਪੰਜਾਬੀ
        </p>
      </footer>
    </div>
  );
}

export default App;
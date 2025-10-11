import React, { useState, useEffect } from 'react';
import './App.css';

// Import components
import TextReader from './components/TextReader';
import DocumentReader from './components/DocumentReader';
import RealTimeReader from './components/RealTimeReader';
import VoiceGallery from './components/VoiceGallery';
import AccessibilityPanel from './components/AccessibilityPanel';
import LanguageSelector from './components/LanguageSelector';
import AccessibilityControls from './components/AccessibilityControls';
import AnalyticsDashboard from './components/AnalyticsDashboard';

function App() {
  const [currentView, setCurrentView] = useState('text');
  const [language, setLanguage] = useState('en');
  const [voice, setVoice] = useState('en_us_nova');
  const [speed, setSpeed] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [highContrast, setHighContrast] = useState(false);

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
        setAvailableVoices([
          { id: 'en_us_nova', name: 'Nova', gender: 'female' },
          { id: 'en_us_ryan', name: 'Ryan', gender: 'male' }
        ]);
      }
    };
    
    loadVoices();
  }, [language]);

  // Apply high contrast mode
  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) {
      root.style.setProperty('--bg-color', '#000000');
      root.style.setProperty('--text-color', '#FFFFFF');
      root.style.setProperty('--primary-color', '#FFFF00');
      document.body.style.backgroundColor = '#000000';
      document.body.style.color = '#FFFFFF';
    } else {
      root.style.setProperty('--bg-color', '#f5f5f5');
      root.style.setProperty('--text-color', '#333333');
      root.style.setProperty('--primary-color', '#667eea');
      document.body.style.backgroundColor = '#f5f5f5';
      document.body.style.color = '#333333';
    }
  }, [highContrast]);

  const views = [
    { id: 'text', name: '📖 Text Reader', description: 'Read any text aloud' },
    { id: 'realtime', name: '⚡ Real-Time', description: 'Instant voice responses' },
    { id: 'analytics', name: '📊 Analytics', description: 'View impact dashboard' },
    { id: 'voices', name: '🌍 Voice Gallery', description: 'Explore Indian languages' },
    { id: 'document', name: '📄 Documents', description: 'Convert documents to audio' },
    { id: 'accessibility', name: '♿ Settings', description: 'Accessibility options' },
    { id: 'about', name: 'ℹ️ About', description: 'Learn about our mission' }
  ];

  const handleVoiceSelect = (voiceId, languageCode) => {
    setVoice(voiceId);
    setLanguage(languageCode);
    setCurrentView('text');
  };

  return (
    <div className={`App ${highContrast ? 'high-contrast' : ''}`}>
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>🎧 VoiceAssist</h1>
          <p>Making Digital Content Accessible for Everyone</p>
          <div className="accessibility-badge">
            ♿ WCAG Compliant • 🌍 10 Indian Languages • ⚡ WebSocket • 📊 Analytics Dashboard
          </div>
        </div>
        
        {/* Quick Accessibility Toggle */}
        <div className="quick-a11y">
          <button 
            className={`contrast-toggle ${highContrast ? 'active' : ''}`}
            onClick={() => setHighContrast(!highContrast)}
            aria-label={highContrast ? 'Disable high contrast mode' : 'Enable high contrast mode'}
          >
            {highContrast ? '🌙 Normal Mode' : '☀️ High Contrast'}
          </button>
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

      {/* Accessibility Controls - Show on relevant pages */}
      {(currentView === 'text' || currentView === 'document' || currentView === 'realtime') && (
        <AccessibilityControls
          language={language}
          voice={voice}
          speed={speed}
          availableVoices={availableVoices}
          onLanguageChange={setLanguage}
          onVoiceChange={setVoice}
          onSpeedChange={setSpeed}
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        {currentView === 'text' && (
          <TextReader
            language={language}
            voice={voice}
            speed={speed}
          />
        )}
        
        {currentView === 'realtime' && (
          <RealTimeReader
            language={language}
            voice={voice}
            speed={speed}
          />
        )}
        
        {currentView === 'analytics' && (
          <AnalyticsDashboard />
        )}
        
        {currentView === 'voices' && (
          <VoiceGallery onVoiceSelect={handleVoiceSelect} />
        )}
        
        {currentView === 'document' && (
          <DocumentReader
            language={language}
            voice={voice}
            speed={speed}
          />
        )}
        
        {currentView === 'accessibility' && (
          <div className="accessibility-section">
            <h2>♿ Accessibility Settings</h2>
            <AccessibilityPanel />
            
            <div className="keyboard-shortcuts">
              <h3>⌨️ Keyboard Navigation Guide</h3>
              <div className="shortcuts-grid">
                <div className="shortcut-group">
                  <h4>Global Shortcuts</h4>
                  <ul>
                    <li><kbd>Tab</kbd> - Navigate through elements</li>
                    <li><kbd>Shift + Tab</kbd> - Navigate backwards</li>
                    <li><kbd>Enter</kbd> - Activate buttons/links</li>
                    <li><kbd>Space</kbd> - Play/pause audio</li>
                    <li><kbd>Escape</kbd> - Close dialogs/cancel</li>
                  </ul>
                </div>
                <div className="shortcut-group">
                  <h4>Text Reader</h4>
                  <ul>
                    <li><kbd>Ctrl + Enter</kbd> - Read text aloud</li>
                    <li><kbd>Ctrl + S</kbd> - Stop audio</li>
                    <li><kbd>Ctrl + ↑</kbd> - Increase speed</li>
                    <li><kbd>Ctrl + ↓</kbd> - Decrease speed</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {currentView === 'about' && (
          <div className="about-section">
            <h2>About VoiceAssist</h2>
            <div className="about-content">
              <p className="mission-statement">
                VoiceAssist is designed to make digital content accessible for people with 
                visual impairments, reading difficulties, or those who prefer auditory learning.
                Our mission is to bridge the digital divide through innovative voice technology.
              </p>
              
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">🌍</div>
                  <h3>Multi-Language Support</h3>
                  <p>10 Indian languages including Hindi, Marathi, Tamil, Telugu, and more with culturally appropriate voices.</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3>Real-Time Processing</h3>
                  <p>WebSocket technology for lightning-fast voice responses and instant audio generation.</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">♿</div>
                  <h3>Full Accessibility</h3>
                  <p>WCAG compliant with screen reader support, keyboard navigation, and high contrast modes.</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <h3>Impact Analytics</h3>
                  <p>Track real-time usage and social impact with comprehensive analytics dashboard.</p>
                </div>
              </div>

              <div className="social-impact">
                <h3>🎯 Social Impact</h3>
                <div className="impact-stats">
                  <div className="stat">
                    <div className="stat-number">10+</div>
                    <div className="stat-label">Indian Languages</div>
                  </div>
                  <div className="stat">
                    <div className="stat-number">♿</div>
                    <div className="stat-label">WCAG Compliant</div>
                  </div>
                  <div className="stat">
                    <div className="stat-number">📊</div>
                    <div className="stat-label">Analytics</div>
                  </div>
                  <div className="stat">
                    <div className="stat-number">∞</div>
                    <div className="stat-label">Free to Use</div>
                  </div>
                </div>
                
                <p className="impact-text">
                  This platform helps bridge the digital divide by making information accessible 
                  to everyone, regardless of visual ability or reading proficiency. We believe 
                  that access to information is a fundamental right, and technology should be 
                  an enabler, not a barrier.
                </p>
              </div>

              <div className="technology-stack">
                <h3>🛠️ Built With</h3>
                <div className="tech-tags">
                  <span className="tech-tag">React</span>
                  <span className="tech-tag">Node.js</span>
                  <span className="tech-tag">WebSocket</span>
                  <span className="tech-tag">Murf AI</span>
                  <span className="tech-tag">Express</span>
                  <span className="tech-tag">CSS3</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Accessibility Announcement Area */}
      <div id="a11y-announcement" aria-live="polite" aria-atomic="true" className="sr-only"></div>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p>
            Built with ❤️ for social good using Murf AI • 
            Supporting: हिन्दी, मराठी, తెలుగు, ಕನ್ನಡ, ગુજરાતી, தமிழ், മലയാളം, বাংলা, ਪੰਜਾਬੀ
          </p>
          <div className="footer-links">
            <button 
              className="footer-link"
              onClick={() => setCurrentView('accessibility')}
            >
              Accessibility
            </button>
            <button 
              className="footer-link"
              onClick={() => setCurrentView('analytics')}
            >
              Analytics
            </button>
            <button 
              className="footer-link"
              onClick={() => setCurrentView('about')}
            >
              About
            </button>
            <span className="version">v2.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
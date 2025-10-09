import React, { useState } from 'react';

const AccessibilityPanel = () => {
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  const applyAccessibilitySettings = () => {
    const root = document.documentElement;
    
    if (highContrast) {
      root.style.setProperty('--bg-color', '#000000');
      root.style.setProperty('--text-color', '#FFFFFF');
      root.style.setProperty('--primary-color', '#FFFF00');
    } else {
      root.style.setProperty('--bg-color', '#f5f5f5');
      root.style.setProperty('--text-color', '#333333');
      root.style.setProperty('--primary-color', '#667eea');
    }
    
    if (largeText) {
      root.style.fontSize = '18px';
    } else {
      root.style.fontSize = '16px';
    }
    
    // Announce changes to screen readers
    if (screenReader) {
      const announcement = document.getElementById('a11y-announcement');
      if (announcement) {
        announcement.textContent = 'Accessibility settings updated';
      }
    }
  };

  React.useEffect(() => {
    applyAccessibilitySettings();
  }, [highContrast, largeText]);

  return (
    <div className="accessibility-panel">
      <h3>♿ Accessibility Settings</h3>
      
      <div className="a11y-options">
        <label className="a11y-toggle">
          <input
            type="checkbox"
            checked={highContrast}
            onChange={(e) => setHighContrast(e.target.checked)}
          />
          <span className="toggle-label">High Contrast Mode</span>
        </label>
        
        <label className="a11y-toggle">
          <input
            type="checkbox"
            checked={largeText}
            onChange={(e) => setLargeText(e.target.checked)}
          />
          <span className="toggle-label">Large Text</span>
        </label>
        
        <label className="a11y-toggle">
          <input
            type="checkbox"
            checked={screenReader}
            onChange={(e) => setScreenReader(e.target.checked)}
          />
          <span className="toggle-label">Screen Reader Optimized</span>
        </label>
      </div>
      
      <div className="a11y-shortcuts">
        <h4>Keyboard Shortcuts:</h4>
        <ul>
          <li>Press <kbd>Tab</kbd> to navigate</li>
          <li>Press <kbd>Space</kbd> to play/pause</li>
          <li>Press <kbd>Enter</kbd> to activate buttons</li>
          <li>Press <kbd>Escape</kbd> to close dialogs</li>
        </ul>
      </div>
      
      <div id="a11y-announcement" aria-live="polite" className="sr-only"></div>
    </div>
  );
};

export default AccessibilityPanel;
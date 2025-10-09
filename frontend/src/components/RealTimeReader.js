import React, { useState, useEffect, useRef } from 'react';

const RealTimeReader = ({ language, voice, speed }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [availableVoices, setAvailableVoices] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket
    wsRef.current = new WebSocket('ws://localhost:8080');
    
    wsRef.current.onopen = () => {
      console.log('✅ Connected to WebSocket');
      setIsConnected(true);
      addMessage('system', 'Real-time voice assistant connected!');
    };
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'audio') {
        playAudio(data.audio);
        setIsProcessing(false);
        addMessage('assistant', `Played ${data.textLength} characters`);
      } else if (data.type === 'status') {
        addMessage('system', 'Processing your request...');
      } else if (data.type === 'error') {
        setIsProcessing(false);
        addMessage('error', data.error);
      } else if (data.type === 'voices') {
        setAvailableVoices(data.voices);
        console.log('✅ Received available voices:', data.voices.slice(0, 3));
      }
    };
    
    wsRef.current.onclose = () => {
      setIsConnected(false);
      addMessage('system', 'Disconnected from voice service');
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      addMessage('error', 'Connection error');
    };
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, { 
      role, 
      text, 
      timestamp: new Date(),
      id: Date.now() + Math.random()
    }].slice(-10)); // Keep last 10 messages
  };

  const playAudio = (base64Audio) => {
    try {
      const audioBlob = base64ToBlob(base64Audio);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = () => {
        console.error('Audio playback failed');
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      addMessage('error', 'Failed to play audio');
    }
  };

  const base64ToBlob = (base64) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'audio/mpeg' });
  };

  const handleQuickAction = (text) => {
    if (!isConnected || isProcessing) return;
    
    setIsProcessing(true);
    addMessage('user', text);
    
    // Use a valid voice - fallback to English voices
    const validVoice = availableVoices.length > 0 ? availableVoices[0] : 'en-US-nova';
    
    wsRef.current.send(JSON.stringify({
      text,
      voice: validVoice, // Use valid voice from server
      language: 'en', // Default to English for now
      requestId: Date.now()
    }));
  };

  const quickActions = [
    { text: "Hello, how are you today?", emoji: "👋" },
    { text: "What time is it?", emoji: "⏰" },
    { text: "Tell me a fun fact", emoji: "💡" },
    { text: "What's the weather like?", emoji: "🌤️" }
  ];

  return (
    <div className="realtime-reader">
      <h2>⚡ Real-Time Voice Assistant</h2>
      <p>Get instant voice responses using WebSocket technology</p>
      
      <div className="connection-status">
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        {availableVoices.length > 0 && (
          <div className="voice-info">
            Using voice: <strong>{availableVoices[0]}</strong>
          </div>
        )}
      </div>

      <div className="quick-actions">
        <h4>Quick Actions:</h4>
        <div className="action-buttons">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleQuickAction(action.text)}
              disabled={!isConnected || isProcessing}
              className="action-btn"
            >
              <span className="action-emoji">{action.emoji}</span>
              <span className="action-text">{action.text}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="message-log">
        <h4>Activity Log:</h4>
        <div className="messages-container">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-content">{msg.text}</div>
              <div className="message-time">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isProcessing && (
        <div className="processing-indicator">
          <div className="spinner"></div>
          Processing your request...
        </div>
      )}

      <div className="websocket-info">
        <h4>🔌 WebSocket Information:</h4>
        <ul>
          <li>Status: {isConnected ? 'Connected' : 'Disconnected'}</li>
          <li>Available Voices: {availableVoices.length}</li>
          <li>Protocol: WebSocket</li>
          <li>Port: 8080</li>
        </ul>
      </div>
    </div>
  );
};

export default RealTimeReader;
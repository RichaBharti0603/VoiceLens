import React, { useState } from 'react';

const DocumentReader = ({ language, voice, speed }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Only support text files for now
    if (file.type !== 'text/plain') {
      alert('Please upload a text file (.txt) for now. More formats coming soon!');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const text = await readFileAsText(file);
      
      // Process in chunks for long documents
      const chunks = splitTextIntoChunks(text, 1000); // 1000 characters per chunk
      
      setProgress(30);
      
      // Convert each chunk to speech
      const audioChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const response = await fetch('http://localhost:5000/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: chunk, 
            voice, 
            language,
            speed 
          })
        });

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioChunks.push(audioUrl);
        
        setProgress(30 + (i / chunks.length) * 70);
      }

      setProgress(100);
      
      // Play all chunks sequentially
      await playAudioChunksSequentially(audioChunks);
      
    } catch (error) {
      console.error('Error processing document:', error);
      alert('Error processing document. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const splitTextIntoChunks = (text, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  };

  const playAudioChunksSequentially = async (audioUrls) => {
    for (const url of audioUrls) {
      await new Promise((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.play();
      });
    }
  };

  return (
    <div className="document-reader">
      <h2>📄 Document Reader</h2>
      <p>Upload text documents to convert them to audio books.</p>
      
      <div className="upload-area">
        <div className="upload-box">
          <input
            type="file"
            id="document-upload"
            accept=".txt,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            disabled={isProcessing}
            style={{ display: 'none' }}
          />
          <label htmlFor="document-upload" className="upload-label">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              {isProcessing ? 'Processing...' : 'Choose Document'}
            </div>
            <div className="upload-subtext">
              Supported: .txt (More formats coming soon)
            </div>
          </label>
        </div>

        {isProcessing && (
          <div className="progress-container">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-text">{Math.round(progress)}%</div>
          </div>
        )}
      </div>

      <div className="document-tips">
        <h4>📋 Tips for Best Results:</h4>
        <ul>
          <li>Use plain text files (.txt) for now</li>
          <li>Ensure proper punctuation for natural pauses</li>
          <li>Break long documents into smaller sections</li>
          <li>Use clear headings and paragraphs</li>
        </ul>
      </div>

      <div className="coming-soon">
        <h4>🚧 Coming Soon:</h4>
        <ul>
          <li>PDF document support</li>
          <li>Word document support</li>
          <li>Chapter navigation</li>
          <li>Bookmarking system</li>
        </ul>
      </div>
    </div>
  );
};

export default DocumentReader;
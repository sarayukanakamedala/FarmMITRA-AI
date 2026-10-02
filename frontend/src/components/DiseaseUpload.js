import React, { useState } from 'react';
import { detectDisease } from '../api/api';

export default function DiseaseUpload({ language }) {
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setResult(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('language', language || 'en-IN');

    try {
      const res = await detectDisease(formData);
      setResult(res.data);

      if (res.data.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${res.data.audioBase64}`);
        audio.play().catch((err) => console.warn('Audio playback failed:', err));
      }
    } catch (err) {
      console.error(err);
      setResult({ error: 'Could not analyze the image. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Paddy Leaf Disease Check</h2>
      <p>Upload a photo of a paddy leaf to check for disease.</p>

      <input type="file" accept="image/*" onChange={handleFileChange} />

      {preview && (
        <img
          src={preview}
          alt="Leaf preview"
          style={{ maxWidth: '100%', maxHeight: 260, marginTop: 12, borderRadius: 8 }}
        />
      )}

      {loading && <p style={{ color: '#888' }}>Analyzing image...</p>}

      {result && !result.error && (
        <div style={{ marginTop: 12, padding: 12, background: '#f1f8f1', borderRadius: 8 }}>
          <h3>{result.disease}</h3>
          <p>Confidence: {Math.round((result.confidence || 0) * 100)}%</p>
          <p>
            <strong>Recommended action:</strong> {result.remedy}
          </p>
          {result.mode && result.mode.startsWith('MOCK') && (
            <p style={{ fontSize: 11, color: '#e65100' }}>
              Note: disease-service is running in MOCK mode (model not yet trained).
            </p>
          )}
        </div>
      )}

      {result && result.error && <p style={{ color: 'red' }}>{result.error}</p>}
    </div>
  );
}

import React, { useState } from 'react';
import { askTextQuery, askVoiceQuery } from '../api/api';
import VoiceRecorder from './VoiceRecorder';

export default function ChatWindow({ farmerLocation }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const playAudio = (base64Audio) => {
    if (!base64Audio) return;
    const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
    audio.play().catch((e) => console.warn('Audio playback failed:', e));
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setMessages((prev) => [...prev, { from: 'farmer', text: question }]);
    setLoading(true);
    try {
      const res = await askTextQuery({
        question,
        state: farmerLocation.state,
        district: farmerLocation.district,
        language: farmerLocation.language,
      });
      setMessages((prev) => [...prev, { from: 'ai', text: res.data.answerText }]);
      playAudio(res.data.audioBase64);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { from: 'ai', text: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
      setQuestion('');
    }
  };

  const handleVoiceRecording = async (audioBlob) => {
    setLoading(true);
    setMessages((prev) => [...prev, { from: 'farmer', text: '🎤 (voice message)' }]);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'query.wav');
    formData.append('state', farmerLocation.state);
    formData.append('district', farmerLocation.district);
    formData.append('language', farmerLocation.language);

    try {
      const res = await askVoiceQuery(formData);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { from: 'farmer', text: res.data.transcribedQuestion },
        { from: 'ai', text: res.data.answerText },
      ]);
      playAudio(res.data.audioBase64);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { from: 'ai', text: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Ask FarmMitra AI</h2>
      <p>Ask about selling time, market prices, or crop care - by voice or text.</p>

      <div style={{ minHeight: 120, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              textAlign: m.from === 'farmer' ? 'right' : 'left',
              margin: '8px 0',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '8px 12px',
                borderRadius: 10,
                background: m.from === 'farmer' ? '#c8e6c9' : '#f1f1f1',
                maxWidth: '80%',
              }}
            >
              {m.text}
            </span>
          </div>
        ))}
        {loading && <p style={{ color: '#888' }}>FarmMitra AI is thinking...</p>}
      </div>

      <VoiceRecorder onRecordingComplete={handleVoiceRecording} />

      <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
          placeholder="Or type your question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}

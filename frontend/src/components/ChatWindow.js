import React, { useCallback, useEffect, useRef, useState } from 'react';
import { askTextQuery, askVoiceQuery, getHistory } from '../api/api';
import { apiError, formatDate, inr, LANGUAGES } from '../utils/helpers';
import { useAudio } from '../utils/audio';
import { useToast } from '../context/Toast';
import VoiceRecorder from './VoiceRecorder';
import WeatherGlyph from './ui/WeatherGlyph';
import Icon from './ui/Icon';

const SUGGESTIONS = [
  'Should I sell my paddy now or wait?',
  'Which mandi near me is paying the best price?',
  'Will rain affect my harvest this week?',
  'How much water does paddy need at tillering?',
];

function Evidence({ priceData, weatherData }) {
  const records = priceData && priceData.found ? [...priceData.records].sort((a, b) => b.modalPrice - a.modalPrice).slice(0, 3) : [];
  const days = weatherData && weatherData.found ? weatherData.forecast.slice(0, 3) : [];
  if (records.length === 0 && days.length === 0) return null;
  return (
    <details className="evidence">
      <summary>Data behind this answer</summary>
      {records.length > 0 && (
        <div className="evidence-block">
          <h4>Mandi prices per quintal</h4>
          <ul>
            {records.map((r, i) => (
              <li key={i}>
                <span>{r.market}{r.district ? `, ${r.district}` : ''}</span>
                <strong>{inr(r.modalPrice)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {days.length > 0 && (
        <div className="evidence-block">
          <h4>Forecast</h4>
          <ul className="evidence-weather">
            {days.map((d) => (
              <li key={d.date}>
                <WeatherGlyph condition={d.condition} size={18} />
                <span>{formatDate(d.date, { weekday: 'short', day: 'numeric' })}</span>
                <strong>{d.avgTemp}°C</strong>
                <span>{d.totalRainMm} mm</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

export default function ChatWindow({ farmer, language, onLanguageChange, prefill, messages, setMessages }) {
  const { notify } = useToast();
  const { play, stop, playingKey } = useAudio();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await getHistory(farmer.phone, 8);
      setHistory(res.data.history || []);
    } catch (err) {
      /* history is optional */
    }
  }, [farmer.phone]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (prefill && prefill.text) {
      setQuestion(prefill.text);
      inputRef.current && inputRef.current.focus();
    }
  }, [prefill]);

  useEffect(() => {
    endRef.current && endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const push = (msg) => setMessages((prev) => [...prev, { id: Date.now() + Math.random(), ...msg }]);

  const ask = async (text) => {
    const q = text.trim();
    if (!q || loading) return;
    push({ from: 'farmer', text: q });
    setQuestion('');
    setLoading(true);
    try {
      const res = await askTextQuery({ question: q, state: farmer.state, district: farmer.district, language, phone: farmer.phone });
      const id = Date.now();
      push({ id, from: 'ai', text: res.data.answerText, audio: res.data.audioBase64, audioError: res.data.audioError, source: res.data.source, priceData: res.data.priceData, weatherData: res.data.weatherData });
      if (res.data.audioBase64) play(id, res.data.audioBase64);
      loadHistory();
    } catch (err) {
      push({ from: 'ai', error: true, text: apiError(err, 'I could not get an answer just now. Check your connection and try again.') });
    } finally {
      setLoading(false);
    }
  };

  const handleVoice = async (blob) => {
    setLoading(true);
    const pendingId = `voice-${Date.now()}`;
    setMessages((prev) => [...prev, { id: pendingId, from: 'farmer', text: 'Transcribing your voice message...', pending: true }]);

    const formData = new FormData();
    formData.append('audio', blob, 'query.wav');
    formData.append('state', farmer.state);
    formData.append('district', farmer.district);
    formData.append('language', language);
    formData.append('phone', farmer.phone);

    try {
      const res = await askVoiceQuery(formData);
      const id = Date.now();
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== pendingId),
        { id: `${id}-q`, from: 'farmer', text: res.data.transcribedQuestion || '(could not hear a question)', voice: true },
        { id, from: 'ai', text: res.data.answerText, audio: res.data.audioBase64, audioError: res.data.audioError, source: res.data.source, priceData: res.data.priceData, weatherData: res.data.weatherData },
      ]);
      if (res.data.audioBase64) play(id, res.data.audioBase64);
      loadHistory();
    } catch (err) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== pendingId),
        { id: `${pendingId}-e`, from: 'ai', error: true, text: apiError(err, 'I could not process that recording. Try again, or type your question.') },
      ]);
      notify('Voice question failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(question);
    }
  };

  return (
    <div className="chat-layout">
      <section className="panel chat">
        <header className="chat-head">
          <div>
            <h2>Ask FarmMitra</h2>
            <p className="muted">Answers use today's mandi prices, the forecast for {farmer.district}, and ICAR crop advice.</p>
          </div>
          <label className="lang-select">
            <span className="sr-only">Reply language</span>
            <select value={language} onChange={(e) => onLanguageChange(e.target.value)} aria-label="Reply language">
              {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.native}</option>))}
            </select>
          </label>
        </header>

        <div className="chat-body" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <span className="chat-empty-icon"><Icon name="mic" size={26} /></span>
              <h3>What would you like to know?</h3>
              <p className="muted">Speak or type. Try one of these:</p>
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => ask(s)} disabled={loading}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`msg msg-${m.from} ${m.error ? 'msg-error' : ''} ${m.pending ? 'msg-pending' : ''}`}>
              <div className="bubble">
                {m.voice && <span className="bubble-tag"><Icon name="mic" size={13} /> Heard</span>}
                <p>{m.text}</p>
                {m.from === 'ai' && !m.error && (
                  <>
                    <Evidence priceData={m.priceData} weatherData={m.weatherData} />
                    {m.source === 'fallback' && (
                      <p className="bubble-note"><Icon name="info" size={14} /> Simple summary from live data. The AI assistant is not connected.</p>
                    )}
                    {!m.audio && m.audioError && (
                      <p className="bubble-note"><Icon name="volume" size={14} /> Voice reply unavailable: {m.audioError}</p>
                    )}
                    {m.audio && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => (playingKey === m.id ? stop() : play(m.id, m.audio))}>
                        <Icon name={playingKey === m.id ? 'stop' : 'volume'} size={16} />
                        {playingKey === m.id ? 'Stop' : 'Listen'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg msg-ai">
              <div className="bubble typing" aria-label="FarmMitra is working on your answer"><i /><i /><i /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <footer className="composer">
          <VoiceRecorder onRecordingComplete={handleVoice} disabled={loading} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your question"
              aria-label="Type your question"
            />
            <button className="btn btn-primary btn-icon" type="submit" disabled={loading || !question.trim()} aria-label="Send question">
              <Icon name="send" size={18} />
            </button>
          </form>
        </footer>
      </section>

      <aside className="panel side-history">
        <h3><Icon name="history" size={18} /> Recent questions</h3>
        {history.length === 0 ? (
          <p className="muted small">Questions you ask will be saved here.</p>
        ) : (
          <ul>
            {history.map((h) => (
              <li key={h._id}>
                <button type="button" onClick={() => { setQuestion(h.queryText.startsWith('[') ? '' : h.queryText); inputRef.current && inputRef.current.focus(); }}>
                  <span className={`dot dot-${h.queryType}`} />
                  <span className="hist-text">
                    <strong>{h.queryText}</strong>
                    <em>{formatDate(h.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
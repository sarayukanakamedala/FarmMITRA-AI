import React, { useEffect, useRef, useState } from 'react';
import { detectDisease } from '../api/api';
import { apiError } from '../utils/helpers';
import { useAudio } from '../utils/audio';
import { useToast } from '../context/Toast';
import Ring from './ui/Ring';
import Icon from './ui/Icon';

const MAX_MB = 8;
const TIPS = [
  'Photograph one leaf in daylight, not under direct sun.',
  'Fill the frame with the leaf and keep the spots in focus.',
  'Hold a plain background, such as your palm, behind the leaf.',
];

const sentences = (text = '') => text.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);

export default function DiseaseUpload({ farmer, language }) {
  const { notify } = useToast();
  const { play, stop, playingKey } = useAudio();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [scans, setScans] = useState([]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const analyse = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Choose a photo (JPG or PNG).', 'error');
    if (file.size > MAX_MB * 1024 * 1024) return notify(`Photo is larger than ${MAX_MB} MB. Choose a smaller one.`, 'error');

    const url = URL.createObjectURL(file);
    setPreview(url);
    setResult(null);
    setLoading(true);
    stop();

    const formData = new FormData();
    formData.append('image', file);
    formData.append('language', language || 'en-IN');
    if (farmer) formData.append('phone', farmer.phone);

    try {
      const res = await detectDisease(formData);
      setResult(res.data);
      setScans((s) => [{ url, disease: res.data.disease, confidence: res.data.confidence, at: new Date() }, ...s].slice(0, 4));
      if (res.data.audioBase64) play('disease', res.data.audioBase64);
    } catch (err) {
      setResult({ error: apiError(err, 'Could not analyse this photo. Check your connection and try again.') });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const reset = () => {
    stop();
    setPreview(null);
    setResult(null);
  };

  const healthy = result && /healthy/i.test(result.disease || '');
  const pct = result && !result.error ? Math.round((result.confidence || 0) * 100) : 0;
  const lowConfidence = result && !result.error && pct < 60;
  const isMock = result && result.mode && /^mock/i.test(result.mode);

  return (
    <div className="two-col">
      <section className="panel">
        <header className="panel-head">
          <div>
            <h2>Leaf disease check</h2>
            <p className="muted">Upload a paddy leaf photo to find the disease and what to do next.</p>
          </div>
          {preview && <button type="button" className="btn btn-ghost btn-sm" onClick={reset}><Icon name="refresh" size={16} /> New photo</button>}
        </header>

        {!preview ? (
          <div
            className={`dropzone ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); analyse(e.dataTransfer.files[0]); }}
          >
            <span className="dropzone-icon"><Icon name="camera" size={28} /></span>
            <h3>Drop a leaf photo here</h3>
            <p className="muted">or take one with your phone camera. JPG or PNG up to {MAX_MB} MB.</p>
            <button type="button" className="btn btn-primary" onClick={() => inputRef.current && inputRef.current.click()}>
              <Icon name="upload" size={18} /> Choose photo
            </button>
          </div>
        ) : (
          <div className="scan-view">
            <div className={`scan-frame ${loading ? 'scanning' : ''}`}>
              <img src={preview} alt="Uploaded paddy leaf" />
              {loading && <span className="scan-line" />}
            </div>
            {loading && <p className="muted center">Analysing the leaf...</p>}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => analyse(e.target.files[0])} />

        {result && result.error && (
          <div className="notice notice-error" role="alert">
            <Icon name="alert" size={18} />
            <div>
              <strong>Analysis failed</strong>
              <p>{result.error}</p>
            </div>
          </div>
        )}

        {result && !result.error && (
          <div className={`result ${healthy ? 'result-ok' : 'result-warn'}`}>
            <div className="result-top">
              <Ring value={pct} size={92} tone={healthy ? 'var(--paddy)' : lowConfidence ? 'var(--grain-deep)' : 'var(--clay)'} sub="sure" />
              <div>
                <span className={`status-pill ${healthy ? 'ok' : 'warn'}`}>{healthy ? 'No disease found' : 'Disease detected'}</span>
                <h3>{result.disease}</h3>
                {lowConfidence && <p className="muted small">Low confidence. Retake the photo in better light, or ask a local agriculture officer to confirm.</p>}
              </div>
              {result.audioBase64 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => (playingKey === 'disease' ? stop() : play('disease', result.audioBase64))}>
                  <Icon name={playingKey === 'disease' ? 'stop' : 'volume'} size={16} /> {playingKey === 'disease' ? 'Stop' : 'Listen'}
                </button>
              )}
            </div>
            <h4>What to do</h4>
            <ol className="remedy">
              {sentences(result.remedy).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            {isMock && (
              <p className="demo-note"><Icon name="info" size={15} /> Demo mode: the disease model has not been trained yet, so this result is a sample.</p>
            )}
          </div>
        )}
      </section>

      <aside className="stack">
        <section className="panel">
          <h3>For a clear result</h3>
          <ul className="tips">{TIPS.map((t) => <li key={t}><Icon name="check" size={16} /> {t}</li>)}</ul>
        </section>
        <section className="panel">
          <h3>Scans this session</h3>
          {scans.length === 0 ? (
            <p className="muted small">Your scans will appear here.</p>
          ) : (
            <ul className="scan-list">
              {scans.map((s, i) => (
                <li key={i}>
                  <img src={s.url} alt="" />
                  <div>
                    <strong>{s.disease}</strong>
                    <span>{Math.round((s.confidence || 0) * 100)}% sure</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
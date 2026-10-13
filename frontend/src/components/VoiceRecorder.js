import React, { useCallback, useEffect, useRef, useState } from 'react';
import { blobToWav } from '../utils/audio';
import { useToast } from '../context/Toast';
import Icon from './ui/Icon';

const MAX_SECONDS = 30;
const SILENCE_RMS = 0.012; // below this the microphone is effectively silent
const BAR_COUNT = 7;

const micError = (err) => {
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone is blocked. Click the lock or camera icon in the address bar, allow the microphone, then reload the page.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found. Plug one in or choose it in your system sound settings.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The microphone is being used by another app. Close it (Zoom, Meet, Teams) and try again.';
    default:
      return 'Could not start the microphone. Type your question instead.';
  }
};

/**
 * Records from the microphone, shows a live input level so you can SEE that
 * sound is being captured, converts the clip to WAV and hands it to the parent.
 * If no sound is detected the clip is not sent.
 */
export default function VoiceRecorder({ onRecordingComplete, disabled }) {
  const { notify } = useToast();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [quiet, setQuiet] = useState(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const ctxRef = useRef(null);
  const peakRef = useRef(0);
  const startedAtRef = useRef(0);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setRecording(false);
  }, []);

  const watchLevel = (stream) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (rms > peakRef.current) peakRef.current = rms;
        setLevel(Math.min(1, rms * 6));
        // After 2 seconds with no sound at all, tell the user.
        setQuiet(Date.now() - startedAtRef.current > 2000 && peakRef.current < SILENCE_RMS);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      /* the meter is a nicety; recording still works without it */
    }
  };

  const start = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      return notify('This browser cannot record audio. Open the app at http://localhost:3000 in Chrome or Edge, or type your question.', 'error');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      peakRef.current = 0;
      startedAtRef.current = Date.now();
      setQuiet(false);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data && e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const heardSomething = peakRef.current >= SILENCE_RMS;
        const raw = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanup();
        setQuiet(false);
        if (!heardSomething) {
          return notify('No sound was picked up. Check that the right microphone is selected in your system sound settings and that it is not muted.', 'error');
        }
        if (raw.size < 1500) return notify('That was too short. Speak for a few seconds before stopping.', 'info');
        try {
          onRecordingComplete(await blobToWav(raw));
        } catch (err) {
          console.warn('WAV conversion failed, sending original recording:', err);
          onRecordingComplete(raw);
        }
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      watchLevel(stream);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      cleanup();
      notify(micError(err), 'error');
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className={`recorder ${recording ? 'live' : ''}`}>
      <button
        type="button"
        className={`mic ${recording ? 'recording' : ''}`}
        onClick={recording ? stop : start}
        disabled={disabled && !recording}
        aria-label={recording ? 'Stop recording and send' : 'Start recording your question'}
      >
        <Icon name={recording ? 'stop' : 'mic'} size={22} />
      </button>
      <div className="recorder-text">
        {recording ? (
          <>
            <strong>Listening {mm}:{ss}</strong>
            {quiet ? <span className="recorder-hint">No sound heard. Check your mic.</span> : <span>Tap to stop and send</span>}
          </>
        ) : (
          <>
            <strong>Speak your question</strong>
            <span>Up to {MAX_SECONDS} seconds</span>
          </>
        )}
      </div>
      {recording && (
        <div className={`meter ${quiet ? 'quiet' : ''}`} aria-hidden="true">
          {Array.from({ length: BAR_COUNT }).map((_, i) => {
            const shape = 0.45 + 0.55 * Math.sin(((i + 1) / (BAR_COUNT + 1)) * Math.PI);
            return <i key={i} style={{ height: `${4 + level * shape * 24}px` }} />;
          })}
        </div>
      )}
    </div>
  );
}
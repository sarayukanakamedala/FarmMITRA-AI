import React, { useCallback, useEffect, useRef, useState } from 'react';
import { blobToWav } from '../utils/audio';
import { useToast } from '../context/Toast';
import Icon from './ui/Icon';

const MAX_SECONDS = 30;

/**
 * Records from the browser microphone, converts the clip to WAV and hands it
 * to the parent. Works as the "no telephony needed" demo path - the same
 * /api/query/voice endpoint can later sit behind an IVR / WhatsApp voice flow.
 */
export default function VoiceRecorder({ onRecordingComplete, disabled }) {
  const { notify } = useToast();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setRecording(false);
  }, []);

  const start = async () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      return notify('This browser cannot record audio. Type your question instead.', 'error');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const raw = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanup();
        if (raw.size < 1500) return notify('That was too short. Hold on and speak for a few seconds.', 'info');
        try {
          onRecordingComplete(await blobToWav(raw));
        } catch (err) {
          console.warn('WAV conversion failed, sending original recording:', err);
          onRecordingComplete(raw);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      notify('Microphone access is blocked. Allow it in the browser address bar and try again.', 'error');
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
            <span>Tap to stop and send</span>
          </>
        ) : (
          <>
            <strong>Speak your question</strong>
            <span>Up to {MAX_SECONDS} seconds</span>
          </>
        )}
      </div>
      {recording && (
        <div className="bars" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}
        </div>
      )}
    </div>
  );
}
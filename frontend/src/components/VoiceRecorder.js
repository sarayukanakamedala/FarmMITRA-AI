import React, { useRef, useState } from 'react';

/**
 * Records audio from the browser mic and hands the resulting Blob back
 * to the parent via onRecordingComplete. This is the "no telephony needed"
 * demo path - a real phone-call/IVR integration can reuse the same backend
 * /api/query/voice endpoint later.
 */
export default function VoiceRecorder({ onRecordingComplete }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        onRecordingComplete(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch (err) {
      alert('Microphone access is required to use voice queries.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current && mediaRecorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <button
        className={`mic-button ${recording ? 'recording' : ''}`}
        onClick={recording ? stopRecording : startRecording}
        type="button"
      >
        {recording ? '■' : '🎤'}
      </button>
      <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
        {recording ? 'Recording... tap to stop' : 'Tap to speak your question'}
      </p>
    </div>
  );
}

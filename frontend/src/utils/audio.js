import { useCallback, useEffect, useRef, useState } from 'react';

/** One audio element at a time: starting a new clip stops the previous one. */
export function useAudio() {
  const audioRef = useRef(null);
  const [playingKey, setPlayingKey] = useState(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingKey(null);
  }, []);

  const play = useCallback(
    (key, base64) => {
      stop();
      if (!base64) return;
      const audio = new Audio(`data:audio/wav;base64,${base64}`);
      audioRef.current = audio;
      setPlayingKey(key);
      audio.onended = () => setPlayingKey((k) => (k === key ? null : k));
      audio.onerror = () => setPlayingKey((k) => (k === key ? null : k));
      audio.play().catch(() => setPlayingKey(null));
    },
    [stop]
  );

  useEffect(() => stop, [stop]);

  return { play, stop, playingKey };
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Browsers record webm/ogg, but the speech API is sent a ".wav" file.
 * Decode the recording and re-encode it as 16 kHz mono PCM WAV.
 */
export async function blobToWav(blob, targetRate = 16000) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * targetRate)), targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), targetRate);
  } finally {
    ctx.close();
  }
}
const axios = require('axios');
const FormData = require('form-data');

const STT_URL = () => process.env.SARVAM_STT_URL || 'https://api.sarvam.ai/speech-to-text';
const TTS_URL = () => process.env.SARVAM_TTS_URL || 'https://api.sarvam.ai/text-to-speech';

// Current Sarvam defaults. Override in .env if Sarvam changes them again.
const TTS_MODEL = () => process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
const TTS_SPEAKER = () => process.env.SARVAM_TTS_SPEAKER || 'shubh';
const TTS_MAX_CHARS = 1400; // bulbul:v2 limit is 1500, v3 is 2500

class SarvamError extends Error {
  constructor(message, status = 502, code = 'sarvam_error') {
    super(message);
    this.name = 'SarvamError';
    this.status = status;
    this.code = code;
  }
}

function requireKey() {
  if (!process.env.SARVAM_API_KEY || !process.env.SARVAM_API_KEY.trim()) {
    throw new SarvamError('SARVAM_API_KEY is missing in backend/.env. Add it and restart the backend.', 500, 'missing_key');
  }
}

/** Turn an axios failure into a short, readable message. */
function explain(err, what) {
  if (err instanceof SarvamError) return err;
  const status = err.response && err.response.status;
  const body = err.response && err.response.data;
  let detail = '';
  if (body) {
    if (typeof body === 'string') detail = body;
    else if (body.error) detail = typeof body.error === 'string' ? body.error : body.error.message || JSON.stringify(body.error);
    else if (body.message) detail = body.message;
    else detail = JSON.stringify(body);
  }
  if (status === 401 || status === 403) return new SarvamError('Sarvam rejected the API key. Check SARVAM_API_KEY in backend/.env.', 502, 'bad_key');
  if (status === 429) return new SarvamError('Sarvam rate limit or credits exhausted. Try again shortly or check your Sarvam dashboard.', 502, 'rate_limited');
  if (err.code === 'ECONNABORTED') return new SarvamError(`${what} timed out. Try again.`, 504, 'timeout');
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'EAI_AGAIN') {
    return new SarvamError('Could not reach Sarvam. Check your internet connection.', 502, 'network');
  }
  return new SarvamError(`${what} failed${status ? ` (${status})` : ''}: ${detail || err.message}`, 502, 'sarvam_error');
}

function audioFilename(mimeType = '') {
  const m = mimeType.toLowerCase();
  if (m.includes('webm')) return 'query.webm';
  if (m.includes('ogg')) return 'query.ogg';
  if (m.includes('mpeg') || m.includes('mp3')) return 'query.mp3';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'query.m4a';
  return 'query.wav';
}

/**
 * Speech to text (Sarvam REST, up to 30 seconds of audio).
 * audioBuffer: Buffer from multer. languageCode: 'te-IN', 'hi-IN', 'en-IN' or 'unknown'.
 */
async function speechToText(audioBuffer, languageCode = 'te-IN', mimeType = 'audio/wav') {
  requireKey();
  const form = new FormData();
  form.append('file', audioBuffer, { filename: audioFilename(mimeType), contentType: mimeType || 'audio/wav' });
  if (languageCode) form.append('language_code', languageCode);
  // Only send a model if you pinned one in .env; otherwise Sarvam uses its current default.
  if (process.env.SARVAM_STT_MODEL) form.append('model', process.env.SARVAM_STT_MODEL);

  try {
    const response = await axios.post(STT_URL(), form, {
      headers: { ...form.getHeaders(), 'api-subscription-key': process.env.SARVAM_API_KEY },
      timeout: 45000,
      maxBodyLength: Infinity,
    });
    return String((response.data && response.data.transcript) || '').trim();
  } catch (err) {
    throw explain(err, 'Speech recognition');
  }
}

function cleanForSpeech(text) {
  let t = String(text || '')
    .replace(/[*_#`>]+/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (t.length > TTS_MAX_CHARS) {
    t = t.slice(0, TTS_MAX_CHARS);
    const cut = Math.max(t.lastIndexOf('. '), t.lastIndexOf('।'), t.lastIndexOf('? '));
    if (cut > 400) t = t.slice(0, cut + 1);
  }
  return t;
}

async function callTts(text, languageCode, model, speaker) {
  const response = await axios.post(
    TTS_URL(),
    { text, target_language_code: languageCode, model, speaker },
    {
      headers: { 'api-subscription-key': process.env.SARVAM_API_KEY, 'Content-Type': 'application/json' },
      timeout: 45000,
    }
  );
  const audio = response.data && response.data.audios && response.data.audios[0];
  if (!audio) throw new SarvamError('Sarvam returned no audio.', 502, 'no_audio');
  return audio;
}

/** Text to speech. Returns base64 WAV the browser can play directly. */
async function textToSpeech(text, languageCode = 'te-IN') {
  requireKey();
  const clean = cleanForSpeech(text);
  if (!clean) throw new SarvamError('Nothing to speak.', 400, 'empty_text');
  try {
    return await callTts(clean, languageCode, TTS_MODEL(), TTS_SPEAKER());
  } catch (err) {
    const status = err.response && err.response.status;
    // If the pinned/default model or voice is rejected, retry once with the older v2 voice.
    if ((status === 400 || status === 422) && !process.env.SARVAM_TTS_MODEL) {
      try {
        return await callTts(clean, languageCode, 'bulbul:v2', 'anushka');
      } catch (retryErr) {
        throw explain(retryErr, 'Text to speech');
      }
    }
    throw explain(err, 'Text to speech');
  }
}

module.exports = { speechToText, textToSpeech, SarvamError };
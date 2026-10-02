const axios = require('axios');
const FormData = require('form-data');

/**
 * Convert farmer's spoken audio (buffer) to text using Sarvam STT.
 * audioBuffer: Buffer from multer file upload
 * languageCode: e.g. 'te-IN', 'hi-IN', 'en-IN'
 */
async function speechToText(audioBuffer, languageCode = 'te-IN') {
  const form = new FormData();
  form.append('file', audioBuffer, { filename: 'query.wav', contentType: 'audio/wav' });
  form.append('language_code', languageCode);
  form.append('model', 'saarika:v2');

  const response = await axios.post(process.env.SARVAM_STT_URL, form, {
    headers: {
      ...form.getHeaders(),
      'api-subscription-key': process.env.SARVAM_API_KEY,
    },
  });

  return response.data.transcript;
}

/**
 * Convert text response to speech using Sarvam TTS.
 * Returns base64-encoded audio which the frontend can play directly.
 */
async function textToSpeech(text, languageCode = 'te-IN') {
  const response = await axios.post(
    process.env.SARVAM_TTS_URL,
    {
      inputs: [text],
      target_language_code: languageCode,
      speaker: 'meera',
      model: 'bulbul:v1',
    },
    {
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  // Sarvam returns base64 audio in `audios` array
  return response.data.audios[0];
}

module.exports = { speechToText, textToSpeech };

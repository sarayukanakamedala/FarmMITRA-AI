const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const { speechToText, textToSpeech } = require('../services/sarvamService');
const { extractCropAndLocation, generateMarketAdvice } = require('../services/llmService');
const { getMandiPrices } = require('../services/marketPriceService');
const { getWeatherForecast } = require('../services/weatherService');
const { retrieveRelevantAdvisory } = require('../services/ragService');
const ChatHistory = require('../models/ChatHistory');
const Farmer = require('../models/Farmer');

const dbReady = () => mongoose.connection.readyState === 1;

async function farmerIdFor(phone) {
  if (!phone || !dbReady()) return null;
  try {
    const f = await Farmer.findOne({ phone }).select('_id');
    return f ? f._id : null;
  } catch (e) {
    return null;
  }
}

async function saveHistory({ phone, question, answerText }) {
  if (!dbReady()) return;
  try {
    await ChatHistory.create({
      farmer: await farmerIdFor(phone),
      queryText: question,
      queryType: 'market',
      responseText: answerText,
    });
  } catch (dbErr) {
    console.warn('Could not save chat history:', dbErr.message);
  }
}

/**
 * Shared pipeline for typed and spoken questions:
 * extract crop/location -> live prices + weather + ICAR notes -> LLM advice -> speech.
 * Every external dependency degrades gracefully, so one missing key never
 * turns the whole request into a 500.
 */
async function runPipeline({ question, state, district, language, phone }) {
  const { crop, state: resolvedState, district: resolvedDistrict } = await extractCropAndLocation(question, state, district);

  const [priceData, weatherData] = await Promise.all([
    getMandiPrices({ commodity: crop, state: resolvedState, district: resolvedDistrict }),
    getWeatherForecast(resolvedDistrict || resolvedState),
  ]);

  let advisoryChunks = [];
  try {
    advisoryChunks = retrieveRelevantAdvisory(question);
  } catch (e) {
    console.warn('Advisory lookup failed:', e.message);
  }

  const advice = await generateMarketAdvice({ question, priceData, weatherData, advisoryChunks, language });

  let audioBase64 = null;
  let audioError = null;
  try {
    audioBase64 = await textToSpeech(advice.text, advice.languageCode);
  } catch (ttsErr) {
    audioError = ttsErr.message;
    console.warn('TTS failed, returning text-only response:', ttsErr.message);
  }

  await saveHistory({ phone, question, answerText: advice.text });

  return { answerText: advice.text, audioBase64, audioError, source: advice.source, priceData, weatherData };
}

/**
 * POST /api/query/text
 * Body: { question, state, district, language, phone }
 */
router.post('/text', async (req, res) => {
  try {
    const { question, state, district, language, phone } = req.body;
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'Please type a question.' });

    const result = await runPipeline({ question: String(question).trim(), state, district, language, phone });
    res.json(result);
  } catch (err) {
    console.error('Text query error:', err);
    res.status(500).json({ error: `Failed to process query: ${err.message}` });
  }
});

const handleUpload = (req, res, next) =>
  upload.single('audio')(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That recording is too large (max 10 MB). Keep it under 30 seconds.' : err.message;
    res.status(400).json({ error: msg });
  });

/**
 * POST /api/query/voice
 * multipart/form-data: { audio: <file>, state, district, language, phone }
 */
router.post('/voice', handleUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio was received. Allow the microphone and try again.' });
    const { state, district, language, phone } = req.body;

    console.log(`[voice] received ${req.file.size} bytes (${req.file.mimetype}), language ${language || 'te-IN'}`);
    if (req.file.size < 1000) {
      return res.status(400).json({ error: 'The recording was empty. Check that the right microphone is selected and speak for a few seconds.' });
    }

    let question;
    try {
      question = await speechToText(req.file.buffer, language || 'te-IN', req.file.mimetype);
    } catch (sttErr) {
      console.error('[voice] speech-to-text failed:', sttErr.message);
      return res.status(sttErr.status || 502).json({ error: sttErr.message, code: sttErr.code || 'stt_failed' });
    }
    console.log(`[voice] transcript: "${question}"`);

    if (!question) {
      return res.status(422).json({
        error: 'I could not hear any speech in that recording. Speak clearly, closer to the microphone, and try again.',
        code: 'no_speech',
      });
    }

    const result = await runPipeline({ question, state, district, language, phone });
    res.json({ transcribedQuestion: question, ...result });
  } catch (err) {
    console.error('Voice query error:', err);
    res.status(500).json({ error: `Failed to process voice query: ${err.message}` });
  }
});

/**
 * GET /api/query/history/:phone?limit=20
 */
router.get('/history/:phone', async (req, res) => {
  try {
    const farmerId = await farmerIdFor(req.params.phone);
    if (!farmerId) return res.json({ history: [] });
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const history = await ChatHistory.find({ farmer: farmerId }).sort({ createdAt: -1 }).limit(limit);
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load history.' });
  }
});

module.exports = router;
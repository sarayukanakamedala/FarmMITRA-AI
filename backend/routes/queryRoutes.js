const express = require('express');
const multer = require('multer');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const { speechToText, textToSpeech } = require('../services/sarvamService');
const { extractCropAndLocation, generateMarketAdvice } = require('../services/llmService');
const { getMandiPrices } = require('../services/marketPriceService');
const { getWeatherForecast } = require('../services/weatherService');
const { retrieveRelevantAdvisory } = require('../services/ragService');
const ChatHistory = require('../models/ChatHistory');

/**
 * POST /api/query/text
 * Body: { question, state, district, language }
 * Text-in, text+audio-out. Used by the web UI's typed-query path,
 * and internally by the voice route after STT.
 */
router.post('/text', async (req, res) => {
  try {
    const { question, state, district, language } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });

    // 1. Figure out crop + location from the farmer's question
    const { crop, state: resolvedState, district: resolvedDistrict } =
      await extractCropAndLocation(question, state, district);

    // 2. Fetch live grounding data in parallel
    const [priceData, weatherData] = await Promise.all([
      getMandiPrices({ commodity: crop, state: resolvedState, district: resolvedDistrict }),
      getWeatherForecast(resolvedDistrict || resolvedState),
    ]);

    const advisoryChunks = retrieveRelevantAdvisory(question);

    // 3. LLM reasons over the grounded data
    const answerText = await generateMarketAdvice({
      question,
      priceData,
      weatherData,
      advisoryChunks,
      language,
    });

    // 4. Convert answer to speech
    let audioBase64 = null;
    try {
      audioBase64 = await textToSpeech(answerText, language || 'en-IN');
    } catch (ttsErr) {
      console.warn('TTS failed, returning text-only response:', ttsErr.message);
    }

    // 5. Log to chat history (best-effort, don't fail the request if DB is down)
    try {
      await ChatHistory.create({
        queryText: question,
        queryType: 'market',
        responseText: answerText,
      });
    } catch (dbErr) {
      console.warn('Could not save chat history:', dbErr.message);
    }

    res.json({ answerText, audioBase64, priceData, weatherData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process query.' });
  }
});

/**
 * POST /api/query/voice
 * multipart/form-data: { audio: <file>, state, district, language }
 * Voice-in, text+audio-out. Full STT -> reasoning -> TTS pipeline.
 */
router.post('/voice', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file is required' });
    const { state, district, language } = req.body;

    // 1. Speech to text
    const question = await speechToText(req.file.buffer, language || 'te-IN');

    // 2-5. Reuse the same pipeline as the text route
    const { crop, state: resolvedState, district: resolvedDistrict } =
      await extractCropAndLocation(question, state, district);

    const [priceData, weatherData] = await Promise.all([
      getMandiPrices({ commodity: crop, state: resolvedState, district: resolvedDistrict }),
      getWeatherForecast(resolvedDistrict || resolvedState),
    ]);

    const advisoryChunks = retrieveRelevantAdvisory(question);

    const answerText = await generateMarketAdvice({
      question,
      priceData,
      weatherData,
      advisoryChunks,
      language,
    });

    const audioBase64 = await textToSpeech(answerText, language || 'te-IN');

    res.json({ transcribedQuestion: question, answerText, audioBase64, priceData, weatherData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process voice query.' });
  }
});

module.exports = router;

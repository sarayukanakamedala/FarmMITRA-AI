const express = require('express');
const multer = require('multer');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });
const { detectDisease } = require('../services/diseaseService');
const { textToSpeech } = require('../services/sarvamService');
const ChatHistory = require('../models/ChatHistory');

/**
 * POST /api/disease/detect
 * multipart/form-data: { image: <file>, language }
 */
router.post('/detect', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file is required' });
    const { language } = req.body;

    const result = await detectDisease(req.file.buffer, req.file.originalname);

    if (!result.success) {
      return res.status(502).json(result);
    }

    const responseText = `Detected: ${result.disease} (confidence ${Math.round(
      (result.confidence || 0) * 100
    )}%). Recommended action: ${result.remedy}`;

    let audioBase64 = null;
    try {
      audioBase64 = await textToSpeech(responseText, language || 'en-IN');
    } catch (ttsErr) {
      console.warn('TTS failed for disease response:', ttsErr.message);
    }

    try {
      await ChatHistory.create({
        queryText: '[Image upload - paddy leaf]',
        queryType: 'disease',
        responseText,
      });
    } catch (dbErr) {
      console.warn('Could not save chat history:', dbErr.message);
    }

    res.json({ ...result, responseText, audioBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process disease detection.' });
  }
});

module.exports = router;

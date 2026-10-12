const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Farmer = require('../models/Farmer');
const Task = require('../models/Task');
const { generateTaskList } = require('../services/cropCalendarService');

const DB_DOWN = {
  error:
    'The database is not connected. Set MONGO_URI in backend/.env (and allow your IP in MongoDB Atlas > Network Access), then restart the backend.',
};
const dbReady = () => mongoose.connection.readyState === 1;

const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '');

/**
 * POST /api/farmers/register
 * Registers a farmer with planting date + soil type, and generates their
 * stage-wise to-do list. Safe to call again for the same phone number:
 * the task list is only generated once.
 */
router.post('/register', async (req, res) => {
  if (!dbReady()) return res.status(503).json(DB_DOWN);
  try {
    const { name, email, preferredLanguage, state, district, plantingDate, soilType } = req.body;
    const phone = cleanPhone(req.body.phone);

    if (!name || !phone || !state || !district || !plantingDate || !soilType) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    if (!['clay', 'loamy', 'sandy'].includes(soilType)) {
      return res.status(400).json({ error: 'Soil type must be clay, loamy or sandy.' });
    }

    let farmer = await Farmer.findOne({ phone });
    let created = false;
    if (!farmer) {
      farmer = await Farmer.create({
        name,
        phone,
        email: email || null,
        preferredLanguage,
        state,
        district,
        plantingDate,
        soilType,
      });
      created = true;
    }

    const existingTasks = await Task.countDocuments({ farmer: farmer._id });
    if (existingTasks === 0) {
      const tasks = generateTaskList(new Date(farmer.plantingDate), farmer.soilType);
      await Task.insertMany(tasks.map((t) => ({ ...t, farmer: farmer._id })));
    }
    const taskCount = await Task.countDocuments({ farmer: farmer._id });

    res.json({ farmer, taskCount, created });
  } catch (err) {
    console.error('Register error:', err);
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    if (err.code === 11000) return res.status(409).json({ error: 'This phone number is already registered. Use Sign in.' });
    res.status(500).json({ error: `Failed to register farmer: ${err.message}` });
  }
});

/**
 * GET /api/farmers/:phone  (also used as "sign in")
 */
router.get('/:phone', async (req, res) => {
  if (!dbReady()) return res.status(503).json(DB_DOWN);
  try {
    const farmer = await Farmer.findOne({ phone: cleanPhone(req.params.phone) });
    if (!farmer) return res.status(404).json({ error: 'No farmer found with this phone number.' });
    res.json(farmer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farmer.' });
  }
});

module.exports = router;
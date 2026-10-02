const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const Task = require('../models/Task');
const { generateTaskList } = require('../services/cropCalendarService');

/**
 * POST /api/farmers/register
 * Registers a farmer with planting date + soil type, and immediately
 * generates their full stage-wise to-do list.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, preferredLanguage, state, district, plantingDate, soilType } = req.body;

    if (!name || !phone || !state || !district || !plantingDate || !soilType) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    let farmer = await Farmer.findOne({ phone });
    if (!farmer) {
      farmer = await Farmer.create({
        name,
        phone,
        email,
        preferredLanguage,
        state,
        district,
        plantingDate,
        soilType,
      });
    }

    // Generate and store the soil-adjusted task list
    const tasks = generateTaskList(new Date(plantingDate), soilType);
    const taskDocs = tasks.map((t) => ({ ...t, farmer: farmer._id }));
    await Task.insertMany(taskDocs);

    res.json({ farmer, taskCount: taskDocs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register farmer.' });
  }
});

/**
 * GET /api/farmers/:phone
 */
router.get('/:phone', async (req, res) => {
  try {
    const farmer = await Farmer.findOne({ phone: req.params.phone });
    if (!farmer) return res.status(404).json({ error: 'Farmer not found.' });
    res.json(farmer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farmer.' });
  }
});

module.exports = router;

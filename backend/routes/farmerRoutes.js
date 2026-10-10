const express = require('express');
const router = express.Router();
const Farmer = require('../models/Farmer');
const Task = require('../models/Task');
const { generateTaskList } = require('../services/cropCalendarService');

const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '');

/**
 * POST /api/farmers/register
 * Registers a farmer with planting date + soil type, and generates their
 * stage-wise to-do list. Safe to call again for the same phone number:
 * the task list is only generated once.
 */
router.post('/register', async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error: 'Failed to register farmer.' });
  }
});

/**
 * GET /api/farmers/:phone  (also used as "sign in")
 */
router.get('/:phone', async (req, res) => {
  try {
    const farmer = await Farmer.findOne({ phone: cleanPhone(req.params.phone) });
    if (!farmer) return res.status(404).json({ error: 'No farmer found with this phone number.' });
    res.json(farmer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch farmer.' });
  }
});

module.exports = router;
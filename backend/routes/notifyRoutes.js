const express = require('express');
const router = express.Router();

const Farmer = require('../models/Farmer');
const Task = require('../models/Task');
const { getDueTasks } = require('../services/cropCalendarService');
const { sendTaskReminderEmail } = require('../services/emailService');

/**
 * POST /api/notify/:phone/email
 * Sends an email reminder of due tasks (optional/secondary notification
 * channel - primary channel is in-app + voice via /api/calendar/:phone/reminder).
 */
router.post('/:phone/email', async (req, res) => {
  try {
    const farmer = await Farmer.findOne({ phone: req.params.phone });
    if (!farmer) return res.status(404).json({ error: 'Farmer not found.' });
    if (!farmer.email) {
      return res.status(400).json({ error: 'No email on file for this farmer.' });
    }

    const allTasks = await Task.find({ farmer: farmer._id, status: 'pending' });
    const dueTasks = getDueTasks(allTasks);

    if (dueTasks.length === 0) {
      return res.json({ sent: false, message: 'No due tasks - nothing to send.' });
    }

    const result = await sendTaskReminderEmail(farmer.email, farmer.name, dueTasks);

    if (result.sent) {
      await Task.updateMany(
        { _id: { $in: dueTasks.map((t) => t._id) } },
        { notifiedByEmail: true }
      );
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email notification.' });
  }
});

module.exports = router;

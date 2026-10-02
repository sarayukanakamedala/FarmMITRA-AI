const express = require('express');
const router = express.Router();

const Farmer = require('../models/Farmer');
const Task = require('../models/Task');
const { getDueTasks } = require('../services/cropCalendarService');
const { phraseTaskReminder } = require('../services/llmService');
const { textToSpeech } = require('../services/sarvamService');

/**
 * GET /api/calendar/:phone/tasks
 * Returns the farmer's full stored task list (for the web dashboard).
 */
router.get('/:phone/tasks', async (req, res) => {
  try {
    const farmer = await Farmer.findOne({ phone: req.params.phone });
    if (!farmer) return res.status(404).json({ error: 'Farmer not found.' });

    const tasks = await Task.find({ farmer: farmer._id }).sort({ dueDate: 1 });
    res.json({ farmer, tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

/**
 * GET /api/calendar/:phone/reminder
 * Returns today's due/pending tasks phrased for TTS - this is what plays
 * when a farmer "calls in" via the voice interface.
 */
router.get('/:phone/reminder', async (req, res) => {
  try {
    const farmer = await Farmer.findOne({ phone: req.params.phone });
    if (!farmer) return res.status(404).json({ error: 'Farmer not found.' });

    const allTasks = await Task.find({ farmer: farmer._id, status: 'pending' });
    const dueTasks = getDueTasks(allTasks);

    const reminderText = await phraseTaskReminder(dueTasks, farmer.preferredLanguage);
    const audioBase64 = await textToSpeech(reminderText, farmer.preferredLanguage || 'en-IN');

    res.json({ dueTasks, reminderText, audioBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate reminder.' });
  }
});

/**
 * PATCH /api/calendar/task/:taskId/complete
 */
router.patch('/task/:taskId/complete', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.taskId,
      { status: 'done' },
      { new: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

module.exports = router;

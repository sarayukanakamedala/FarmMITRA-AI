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

    const docs = await Task.find({ farmer: farmer._id }).sort({ dueDate: 1 });

    // A pending task whose due date has passed is reported as "overdue".
    const startOfToday = new Date(new Date().toDateString());
    const tasks = docs.map((t) => {
      const obj = t.toObject();
      if (obj.status === 'pending' && new Date(obj.dueDate) < startOfToday) obj.status = 'overdue';
      return obj;
    });

    const summary = {
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'done').length,
      overdue: tasks.filter((t) => t.status === 'overdue').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
    };
    res.json({ farmer, tasks, summary });
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

    const reminder = await phraseTaskReminder(dueTasks, farmer.preferredLanguage);
    let audioBase64 = null;
    try {
      audioBase64 = await textToSpeech(reminder.text, reminder.languageCode);
    } catch (ttsErr) {
      console.warn('Reminder TTS failed, returning text only:', ttsErr.message);
    }

    res.json({ dueTasks, reminderText: reminder.text, audioBase64 });
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

/**
 * PATCH /api/calendar/task/:taskId/reopen
 * Lets a farmer undo an accidental "Mark done".
 */
router.patch('/task/:taskId/reopen', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.taskId, { status: 'pending' }, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

module.exports = router;
const fs = require('fs');
const path = require('path');

const CALENDAR_PATH = path.join(__dirname, '..', 'data', 'paddyCalendar.json');
const calendarData = JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf-8'));

/**
 * Generates a full stage-wise, soil-adjusted task list for a farmer given
 * their planting date and soil type. Pure rule-based logic - no LLM involved,
 * so it's deterministic and reliable for a live demo.
 */
function generateTaskList(plantingDate, soilType) {
  const soilAdj = calendarData.soilAdjustments[soilType] || calendarData.soilAdjustments.loamy;
  const tasks = [];

  calendarData.stages.forEach((stageObj) => {
    stageObj.baseTasks.forEach((task) => {
      // Apply soil-based irrigation offset only to irrigation/water-related tasks
      const isIrrigationTask = /irrigat|water/i.test(task.title);
      const offset = isIrrigationTask ? soilAdj.irrigationOffsetDays : 0;

      const dueDate = new Date(plantingDate);
      dueDate.setDate(dueDate.getDate() + task.offsetDay + offset);

      tasks.push({
        stage: stageObj.stage,
        title: task.title,
        details: isIrrigationTask
          ? `${task.details} (Soil note: ${soilAdj.irrigationNote})`
          : /fertiliz/i.test(task.title)
          ? `${task.details} (Soil note: ${soilAdj.fertilizerNote})`
          : task.details,
        dueDate,
      });
    });
  });

  // Sort chronologically
  tasks.sort((a, b) => a.dueDate - b.dueDate);
  return tasks;
}

/**
 * Filters a task list to tasks due today or overdue-and-still-pending,
 * for the voice-call reminder feature.
 */
function getDueTasks(tasks, referenceDate = new Date()) {
  const today = new Date(referenceDate.toDateString());
  return tasks.filter((t) => {
    const due = new Date(new Date(t.dueDate).toDateString());
    return due <= today && t.status !== 'done';
  });
}

module.exports = { generateTaskList, getDueTasks };

import React, { useEffect, useState } from 'react';
import { getTasks, getVoiceReminder, completeTask, sendEmailReminder } from '../api/api';

export default function TodoDashboard({ phone }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState(null);

  const loadTasks = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const res = await getTasks(phone);
      setTasks(res.data.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const handleComplete = async (taskId) => {
    await completeTask(taskId);
    loadTasks();
  };

  const handlePlayReminder = async () => {
    try {
      const res = await getVoiceReminder(phone);
      if (res.data.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${res.data.audioBase64}`);
        audio.play();
      } else {
        alert(res.data.reminderText);
      }
    } catch (err) {
      console.error(err);
      alert('Could not load voice reminder.');
    }
  };

  const handleEmailReminder = async () => {
    setEmailStatus('sending');
    try {
      const res = await sendEmailReminder(phone);
      setEmailStatus(res.data.sent ? 'sent' : 'skipped');
    } catch (err) {
      console.error(err);
      setEmailStatus('error');
    }
  };

  if (!phone) {
    return (
      <div className="card">
        <p>Register your crop first to see your personalized to-do list.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Your Paddy Crop Calendar</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button className="btn-secondary" onClick={handlePlayReminder}>
          🔊 Play Today's Reminder
        </button>
        <button className="btn-secondary" onClick={handleEmailReminder}>
          ✉️ Email Reminder
        </button>
      </div>

      {emailStatus === 'sent' && <p style={{ color: 'green' }}>Email sent!</p>}
      {emailStatus === 'skipped' && <p style={{ color: '#888' }}>No due tasks to email right now.</p>}
      {emailStatus === 'error' && <p style={{ color: 'red' }}>Could not send email.</p>}

      {loading && <p>Loading tasks...</p>}

      {!loading &&
        tasks.map((task) => (
          <div key={task._id} className={`task-item ${task.status === 'done' ? 'done' : ''}`}>
            <div>
              <span className="badge">{task.stage}</span>
              <div style={{ fontWeight: 600 }}>{task.title}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                Due: {new Date(task.dueDate).toDateString()}
              </div>
            </div>
            {task.status !== 'done' && (
              <button className="btn-secondary" onClick={() => handleComplete(task._id)}>
                Mark Done
              </button>
            )}
          </div>
        ))}

      {!loading && tasks.length === 0 && <p>No tasks found yet.</p>}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { completeTask, getTasks, getVoiceReminder, reopenTask, sendEmailReminder } from '../api/api';
import { apiError, CROP_STAGES, formatDate, relativeDue } from '../utils/helpers';
import { useAudio } from '../utils/audio';
import { useToast } from '../context/Toast';
import Ring from './ui/Ring';
import Skeleton from './ui/Skeleton';
import Icon from './ui/Icon';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due now' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'done', label: 'Done' },
];

export default function TodoDashboard({ farmer, refreshKey, onChanged }) {
  const { notify } = useToast();
  const { play, stop, playingKey } = useAudio();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await getTasks(farmer.phone);
      setTasks(res.data.tasks);
    } catch (err) {
      setLoadError(apiError(err, 'Could not load your tasks. Check that the backend is running.'));
    } finally {
      setLoading(false);
    }
  }, [farmer.phone]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const today = new Date(new Date().toDateString());
  const isDue = (t) => t.status !== 'done' && new Date(t.dueDate) <= new Date(today.getTime() + 86399999);

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done').length;
    return {
      total: tasks.length,
      done,
      overdue: tasks.filter((t) => t.status === 'overdue').length,
      due: tasks.filter(isDue).length,
      pct: tasks.length ? (done / tasks.length) * 100 : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const visible = tasks.filter((t) => {
    if (filter === 'done') return t.status === 'done';
    if (filter === 'due') return isDue(t);
    if (filter === 'upcoming') return t.status !== 'done' && !isDue(t);
    return true;
  });

  const groups = CROP_STAGES.map((s) => ({ stage: s.name, items: visible.filter((t) => t.stage === s.name) })).filter((g) => g.items.length);

  const toggle = async (task) => {
    const finishing = task.status !== 'done';
    setBusy((b) => ({ ...b, [task._id]: true }));
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status: finishing ? 'done' : 'pending' } : t)));
    try {
      await (finishing ? completeTask(task._id) : reopenTask(task._id));
      if (finishing) notify('Task marked done.', 'success');
      onChanged && onChanged();
    } catch (err) {
      notify(apiError(err, 'Could not update the task.'), 'error');
      load();
    } finally {
      setBusy((b) => ({ ...b, [task._id]: false }));
    }
  };

  const playReminder = async () => {
    if (playingKey === 'reminder') return stop();
    setBusy((b) => ({ ...b, reminder: true }));
    try {
      const res = await getVoiceReminder(farmer.phone);
      if (res.data.audioBase64) play('reminder', res.data.audioBase64);
      else notify(res.data.reminderText || 'No reminder available.', 'info');
    } catch (err) {
      notify(apiError(err, 'Could not load the voice reminder.'), 'error');
    } finally {
      setBusy((b) => ({ ...b, reminder: false }));
    }
  };

  const emailReminder = async () => {
    if (!farmer.email) return notify('Add an email address to your profile to get email reminders.', 'info');
    setBusy((b) => ({ ...b, email: true }));
    try {
      const res = await sendEmailReminder(farmer.phone);
      notify(res.data.sent ? `Reminder emailed to ${farmer.email}.` : res.data.message || res.data.reason || 'No due tasks to email right now.', res.data.sent ? 'success' : 'info');
    } catch (err) {
      notify(apiError(err, 'Could not send the email.'), 'error');
    } finally {
      setBusy((b) => ({ ...b, email: false }));
    }
  };

  return (
    <div className="stack">
      <section className="panel summary">
        <Ring value={stats.pct} size={104} stroke={10} sub="done" />
        <div className="summary-text">
          <h2>Crop calendar</h2>
          <p className="muted">
            {stats.total ? `${stats.done} of ${stats.total} tasks finished.` : 'Your tasks will appear here.'} Dates adjust to your {farmer.soilType} soil.
          </p>
          <div className="stat-row">
            <span className="stat"><b>{stats.due}</b> due now</span>
            <span className={`stat ${stats.overdue ? 'stat-bad' : ''}`}><b>{stats.overdue}</b> overdue</span>
            <span className="stat"><b>{stats.total - stats.done}</b> remaining</span>
          </div>
        </div>
        <div className="summary-actions">
          <button type="button" className="btn btn-secondary" onClick={playReminder} disabled={busy.reminder}>
            <Icon name={playingKey === 'reminder' ? 'stop' : 'volume'} size={18} />
            {busy.reminder ? 'Preparing...' : playingKey === 'reminder' ? 'Stop reminder' : "Play today's reminder"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={emailReminder} disabled={busy.email}>
            <Icon name="mail" size={18} /> {busy.email ? 'Sending...' : 'Email me due tasks'}
          </button>
        </div>
      </section>

      <div className="segmented segmented-wide" role="tablist" aria-label="Filter tasks">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'on' : ''} type="button" onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <section className="panel"><Skeleton height={20} width="40%" /><Skeleton height={56} style={{ marginTop: 14 }} /><Skeleton height={56} style={{ marginTop: 10 }} /><Skeleton height={56} style={{ marginTop: 10 }} /></section>
      )}

      {!loading && loadError && (
        <div className="notice notice-error" role="alert">
          <Icon name="alert" size={18} />
          <div><strong>Tasks did not load</strong><p>{loadError}</p><button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button></div>
        </div>
      )}

      {!loading && !loadError && groups.length === 0 && (
        <section className="panel empty">
          <Icon name="calendar" size={28} />
          <h3>{filter === 'all' ? 'No tasks yet' : 'Nothing here'}</h3>
          <p className="muted">{filter === 'done' ? 'Finished tasks will show up here.' : filter === 'due' ? 'You are all caught up for today.' : 'No tasks match this filter.'}</p>
        </section>
      )}

      {!loading && groups.map((g) => (
        <section key={g.stage} className="panel stage">
          <h3 className="stage-title">{g.stage}</h3>
          <ul className="timeline">
            {g.items.map((t) => {
              const overdue = t.status === 'overdue';
              return (
                <li key={t._id} className={`task ${t.status}`}>
                  <button
                    type="button"
                    className="check"
                    onClick={() => toggle(t)}
                    disabled={busy[t._id]}
                    aria-label={t.status === 'done' ? `Mark "${t.title}" as not done` : `Mark "${t.title}" as done`}
                    aria-pressed={t.status === 'done'}
                  >
                    {t.status === 'done' && <Icon name="check" size={16} strokeWidth={2.4} />}
                  </button>
                  <div className="task-main">
                    <strong>{t.title}</strong>
                    {t.details && <p>{t.details}</p>}
                  </div>
                  <div className="task-when">
                    <span className={`due ${overdue ? 'due-bad' : ''} ${t.status === 'done' ? 'due-done' : ''}`}>{relativeDue(t.dueDate, t.status)}</span>
                    <span className="date">{formatDate(t.dueDate, { day: 'numeric', month: 'short' })}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
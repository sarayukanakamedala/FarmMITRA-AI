export const LANGUAGES = [
  { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
  { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { code: 'en-IN', label: 'English', native: 'English' },
];

// Mirrors backend/data/paddyCalendar.json (day 0 = planting / nursery sowing)
export const CROP_DAYS = 120;
export const CROP_STAGES = [
  { name: 'Nursery', start: 0, end: 20 },
  { name: 'Transplanting', start: 20, end: 25 },
  { name: 'Tillering', start: 25, end: 55 },
  { name: 'Panicle Initiation', start: 55, end: 70 },
  { name: 'Flowering', start: 70, end: 95 },
  { name: 'Maturity & Harvest', start: 95, end: 120 },
];

const DAY_MS = 86400000;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

export const stageAt = (day) =>
  CROP_STAGES.find((s) => day >= s.start && day < s.end) || (day >= CROP_DAYS ? CROP_STAGES[CROP_STAGES.length - 1] : null);

export const formatDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('en-IN', opts);

export function relativeDue(due, status) {
  const diff = daysBetween(new Date(), due);
  if (status === 'done') return 'Completed';
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff > 1) return `Due in ${diff} days`;
  if (diff === -1) return '1 day overdue';
  return `${Math.abs(diff)} days overdue`;
}

export const inr = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? `₹${v.toLocaleString('en-IN')}` : '-';
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const apiError = (err, fallback = 'Something went wrong. Please try again.') =>
  (err && err.response && err.response.data && (err.response.data.error || err.response.data.message)) || fallback;

export const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '');
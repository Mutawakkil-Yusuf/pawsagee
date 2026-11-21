// Everything derived from reading sessions. Days are the reader's local calendar days.
export const MILESTONES = [3, 7, 14, 30, 100];

const pad = n => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); };

export function dayMap(sessions) {
  const m = new Map();
  for (const s of sessions) {
    const k = dayKey(s.started_at);
    const o = m.get(k) || { sec: 0, pages: 0, n: 0 };
    o.sec += s.duration_sec || 0; o.pages += s.pages_read || 0; o.n++;
    m.set(k, o);
  }
  return m;
}

export function currentStreak(m) {
  const t = dayKey();
  let k = m.has(t) ? t : addDays(t, -1), n = 0;
  while (m.has(k)) { n++; k = addDays(k, -1); }
  return n;
}

export function longestStreak(m, prefix = '') {
  const ks = [...m.keys()].filter(k => k.startsWith(prefix)).sort();
  let best = 0, run = 0, prev = null;
  for (const k of ks) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  return best;
}

export function daysSinceLastRead(m) {
  if (!m.size) return null;
  const last = [...m.keys()].sort().pop();
  const a = new Date(last + 'T00:00:00'), b = new Date(dayKey() + 'T00:00:00');
  return Math.round((b - a) / 864e5);
}

/** Monday-first week containing today. */
export function weekStrip(m) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const start = addDays(dayKey(now), -dow);
  const today = dayKey();
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
    const key = addDays(start, i);
    const state = key === today ? (m.has(key) ? 'today-read' : 'today') : key > today ? 'future' : m.has(key) ? 'read' : 'missed';
    return { key, label, state };
  });
}

export function monthGrid(year, month, m) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const today = dayKey();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    cells.push({ d, key, read: m.has(key), today: key === today, future: key > today });
  }
  return cells;
}

export function monthStats(year, month, { sessions, books }) {
  const prefix = `${year}-${pad(month + 1)}`;
  const inMonth = sessions.filter(s => dayKey(s.started_at).startsWith(prefix));
  const m = dayMap(inMonth);
  const finished = books.filter(b => b.status === 'finished' && b.finished_at && b.finished_at.startsWith(prefix));
  return {
    pages: inMonth.reduce((a, s) => a + (s.pages_read || 0), 0),
    seconds: inMonth.reduce((a, s) => a + (s.duration_sec || 0), 0),
    best: longestStreak(m),
    days: m.size,
    finished,
  };
}

export const finishedInYear = (books, year = new Date().getFullYear()) =>
  books.filter(b => b.status === 'finished' && b.finished_at && b.finished_at.startsWith(String(year))).length;

// Celebrations are shown at most once per streak run
const CKEY = 'pawsage.celebrated';
const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(CKEY)) || []); } catch { return new Set(); } };
export const celebrationKey = (type, n, id = '') => type === 'streak' ? `streak:${n}:${addDays(dayKey(), -(n - 1))}` : `${type}:${id || n}`;
export const wasCelebrated = key => seen().has(key);
export function markCelebrated(key) {
  try { const s = seen(); s.add(key); localStorage.setItem(CKEY, JSON.stringify([...s].slice(-200))); } catch { /* ignore */ }
}

export const fmtMin = sec => sec >= 3600 ? `${Math.floor(sec / 3600)} h` : `${Math.round(sec / 60)} min`;
export const fmtClock = sec => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };

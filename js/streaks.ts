// Everything derived from reading sessions. Days are the reader's LOCAL calendar days.
// This module is the single source of truth for streaks in the client; the SQL
// helpers were removed from the schema so there is no second, divergent answer.
import type { ReadingSession, UserBook } from './types';

export const MILESTONES = [3, 7, 14, 30, 100];

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date | string | number = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const addDays = (key: string, n: number) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); };

export interface DayInfo { sec: number; pages: number; n: number }
export function dayMap(sessions: ReadingSession[], keyOf: (s: ReadingSession) => string = s => dayKey(s.started_at)): Map<string, DayInfo> {
  const m = new Map<string, DayInfo>();
  for (const s of sessions) {
    const k = keyOf(s);
    const o = m.get(k) || { sec: 0, pages: 0, n: 0 };
    o.sec += s.duration_sec || 0; o.pages += s.pages_read || 0; o.n++;
    m.set(k, o);
  }
  return m;
}

export function currentStreak(m: Map<string, unknown>, today = dayKey()): number {
  let k = m.has(today) ? today : addDays(today, -1), n = 0;
  while (m.has(k)) { n++; k = addDays(k, -1); }
  return n;
}

export function longestStreak(m: Map<string, unknown>, prefix = ''): number {
  const ks = [...m.keys()].filter(k => k.startsWith(prefix)).sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const k of ks) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  return best;
}

export function daysSinceLastRead(m: Map<string, unknown>, today = dayKey()): number | null {
  if (!m.size) return null;
  const last = [...m.keys()].sort().pop()!;
  const a = new Date(last + 'T00:00:00'), b = new Date(today + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

/** Monday-first week containing today. */
export function weekStrip(m: Map<string, unknown>, now = new Date()) {
  const dow = (now.getDay() + 6) % 7;
  const start = addDays(dayKey(now), -dow);
  const today = dayKey(now);
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
    const key = addDays(start, i);
    const state = key === today ? (m.has(key) ? 'today-read' : 'today') : key > today ? 'future' : m.has(key) ? 'read' : 'missed';
    return { key, label, state };
  });
}

export interface CalCell { d: number; key: string; read: boolean; today: boolean; future: boolean }
export function monthGrid(year: number, month: number, m: Map<string, unknown>): (CalCell | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const today = dayKey();
  const cells: (CalCell | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    cells.push({ d, key, read: m.has(key), today: key === today, future: key > today });
  }
  return cells;
}

export interface MonthStats { pages: number; seconds: number; best: number; days: number; finished: UserBook[] }
export function monthStats(year: number, month: number, { sessions, books }: { sessions: ReadingSession[]; books: UserBook[] }): MonthStats {
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

export const finishedInYear = (books: UserBook[], year = new Date().getFullYear()) =>
  books.filter(b => b.status === 'finished' && b.finished_at && b.finished_at.startsWith(String(year))).length;

// Celebrations are shown at most once per streak run
const CKEY = 'pawsage.celebrated';
const seen = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(CKEY) || '') as string[] || []); } catch { return new Set(); } };
/** A streak milestone is keyed to the first day of that streak run. */
export const celebrationKey = (type: string, n: number | string, id = '', today = dayKey()) =>
  type === 'streak' ? `streak:${n}:${addDays(today, -(Number(n) - 1))}` : `${type}:${id || n}`;
export const wasCelebrated = (key: string) => seen().has(key);
export function markCelebrated(key: string) {
  try { const s = seen(); s.add(key); localStorage.setItem(CKEY, JSON.stringify([...s].slice(-200))); } catch { /* ignore */ }
}

export const fmtMin = (sec: number) => sec >= 3600 ? `${Math.floor(sec / 3600)} h` : `${Math.round(sec / 60)} min`;
export const fmtClock = (sec: number) => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };

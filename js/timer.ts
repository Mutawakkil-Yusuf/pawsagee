// Reading-session timer. Elapsed time always comes from timestamps, so reloads and background tabs can't drift it.
export interface ActiveSession {
  userBookId: string;
  startPage: number;
  startedAt: number;
  pausedMs: number;
  pausedAt: number | null;
  goalHit?: boolean;
  page?: number;
}

const KEY = 'pawsage.active';
const read = (): ActiveSession | null => { try { return JSON.parse(localStorage.getItem(KEY) || '') as ActiveSession | null; } catch { return null; } };
const write = (s: ActiveSession | null) => { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

export const active = read;
export const begin = (userBookId: string, startPage: number): ActiveSession => {
  const s: ActiveSession = { userBookId, startPage, startedAt: Date.now(), pausedMs: 0, pausedAt: null, goalHit: false };
  write(s); return s;
};
/** Elapsed seconds derived from timestamps — never from interval ticks. */
export const elapsedSec = (s: ActiveSession, now = Date.now()): number => Math.max(0, Math.floor(((s.pausedAt ?? now) - s.startedAt - s.pausedMs) / 1000));
export function pause(s: ActiveSession, now = Date.now()): ActiveSession { if (!s.pausedAt) { s.pausedAt = now; write(s); } return s; }
export function resume(s: ActiveSession, now = Date.now()): ActiveSession { if (s.pausedAt) { s.pausedMs += now - s.pausedAt; s.pausedAt = null; write(s); } return s; }
export const save = write;
export const clear = () => write(null);

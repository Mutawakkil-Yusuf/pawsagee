// Reading-session timer. Elapsed time always comes from timestamps, so reloads and background tabs can't drift it.
const KEY = 'pawsage.active';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const write = s => { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

export const active = read;
export const begin = (userBookId, startPage) => { const s = { userBookId, startPage, startedAt: Date.now(), pausedMs: 0, pausedAt: null, goalHit: false }; write(s); return s; };
export const elapsedSec = s => Math.max(0, Math.floor(((s.pausedAt ?? Date.now()) - s.startedAt - s.pausedMs) / 1000));
export function pause(s) { if (!s.pausedAt) { s.pausedAt = Date.now(); write(s); } return s; }
export function resume(s) { if (s.pausedAt) { s.pausedMs += Date.now() - s.pausedAt; s.pausedAt = null; write(s); } return s; }
export const save = write;
export const clear = () => write(null);

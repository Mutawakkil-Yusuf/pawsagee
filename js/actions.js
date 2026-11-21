// Store-level operations: call the db, update the store, keep the UI in step.
import { db, deviceTz } from './db.js';
import * as store from './store.js';
import { toast } from './ui.js';
import { sfx } from './sound.js';
import { backfill } from './covers.js';

const QKEY = 'pawsage.queue';
const today = () => new Date().toISOString().slice(0, 10);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function refresh() {
  const d = await db.loadAll();
  // sessions still waiting in the offline queue count toward stats
  const q = readQueue().map(s => ({ ...s, id: s._qid, pages_read: Math.max(0, s.end_page - s.start_page) }));
  store.set({ ...d, sessions: [...q, ...d.sessions], ready: true });
  // books with no cover yet: look for one in the background, and remember it where we're allowed to
  backfill(d.books, (b, url) => { if (!b.cover_url) db.updateCatalog(b.id, { cover_url: url }).catch(() => {}); }).catch(() => {});
}

export async function boot(session) {
  store.set({ session });
  if (!session) { store.set({ profile: null, shelves: [], books: [], sessions: [], ready: false }); return; }
  try {
    await refresh();
    const p = store.get().profile;
    if (p && p.timezone !== deviceTz()) { db.updateProfile({ timezone: deviceTz() }).catch(() => {}); }
    flushQueue();
  } catch (e) { console.warn(e); toast('mochi dropped something. try again?'); sfx.error(); }
}

const run = async (fn, errMsg = 'mochi dropped something. try again?') => {
  try { return await fn(); } catch (e) { console.warn(e); toast(errMsg); sfx.error(); await refresh().catch(() => {}); return null; }
};

/* ---------- books ---------- */
export const addBook = (b, status = 'want', shelfId = null) => run(async () => { const r = await db.addBook(b, status, shelfId); await refresh(); return r; });
export const removeBook = id => run(async () => { await db.removeBook(id); await refresh(); return true; });

/** Optimistic patch: the screen updates at once, the write follows. */
export function patchBook(id, patch) {
  const s = store.get();
  store.set({ books: s.books.map(b => b.id === id ? { ...b, ...patch, updated_at: new Date().toISOString() } : b) });
  return run(() => db.updateBook(id, patch));
}

export function setStatus(ub, status) {
  const patch = { status };
  const total = ub.book.page_count;
  if (status === 'finished') { patch.finished_at = localToday(); if (total) patch.current_page = total; if (!ub.started_at) patch.started_at = localToday(); }
  if (status === 'reading' && !ub.started_at) patch.started_at = localToday();
  if (status !== 'finished') patch.finished_at = null;
  return patchBook(ub.id, patch);
}

export const setBookShelves = (id, shelfIds) => run(async () => { await db.setShelves(id, shelfIds); await refresh(); });
export const setPages = (ub, { total, current }) => run(async () => {
  if (total !== undefined) await db.updateCatalog(ub.book_id, { page_count: total });
  if (current !== undefined) await db.updateBook(ub.id, { current_page: current });
  await refresh();
});

/* ---------- shelves ---------- */
export const createShelf = (name, color) => run(async () => { const r = await db.createShelf({ name, color, sort_order: store.get().shelves.length }); await refresh(); return r; });
export const updateShelf = (id, p) => run(async () => { await db.updateShelf(id, p); await refresh(); });
export const deleteShelf = id => run(async () => { await db.deleteShelf(id); await refresh(); });
export async function moveShelf(id, dir) {
  const list = [...store.get().shelves];
  const i = list.findIndex(s => s.id === id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await run(async () => { await Promise.all(list.map((s, k) => s.sort_order === k ? null : db.updateShelf(s.id, { sort_order: k }))); await refresh(); });
}

/* ---------- profile ---------- */
export function patchProfile(p) {
  store.set({ profile: { ...store.get().profile, ...p } });
  return run(() => db.updateProfile(p));
}

/* ---------- sessions (with an offline queue) ---------- */
const readQueue = () => { try { return JSON.parse(localStorage.getItem(QKEY)) || []; } catch { return []; } };
const writeQueue = q => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch { /* ignore */ } };

export async function saveSession(s) {
  try {
    await db.addSession(s);
  } catch (e) {
    console.warn('queued session', e);
    writeQueue([...readQueue(), { ...s, _qid: crypto.randomUUID() }]);
  }
  await refresh().catch(() => {});
}

export async function flushQueue() {
  const q = readQueue();
  if (!q.length || !store.get().online) return;
  const left = [];
  for (const { _qid, ...s } of q) { try { await db.addSession(s); } catch { left.push({ ...s, _qid }); } }
  writeQueue(left);
  if (left.length !== q.length) refresh().catch(() => {});
}

/* ---------- selectors ---------- */
export const currentBook = () => store.get().books.find(b => b.status === 'reading') || null;
export const bookById = id => store.get().books.find(b => b.id === id) || null;
export const firstName = () => (store.get().profile?.display_name || 'reader').split(/[\s@]/)[0];

export async function loadSample() {
  const demo = [
    { key: '/works/s1', title: 'Why Nations Fail', isbn: '9780307719225', authors: ['Daron Acemoglu', 'James A. Robinson'], first_publish_year: 2012, page_count: 464, st: 'reading' },
    { key: '/works/s2', title: 'Americanah', isbn: '9780307455925', authors: ['Chimamanda Ngozi Adichie'], first_publish_year: 2013, page_count: 477, st: 'want' },
    { key: '/works/s3', title: 'Sapiens', isbn: '9780062316097', authors: ['Yuval Noah Harari'], first_publish_year: 2011, page_count: 443, st: 'want' },
    { key: '/works/s4', title: 'Kintu', isbn: '9781617756177', authors: ['Jennifer Nansubuga Makumbi'], first_publish_year: 2014, page_count: 448, st: 'want' },
    { key: '/works/s5', title: 'Dune', isbn: '9780441013593', authors: ['Frank Herbert'], first_publish_year: 1965, page_count: 612, st: 'finished' },
    { key: '/works/s6', title: 'Atomic Habits', isbn: '9780735211292', authors: ['James Clear'], first_publish_year: 2018, page_count: 320, st: 'finished' },
  ];
  const shelf = store.get().shelves[0]?.id || null;
  for (const b of demo) await db.addBook(b, b.st, shelf);
  await refresh();
  const r = store.get().books.find(b => b.book.title === 'Why Nations Fail');
  if (r) await db.updateBook(r.id, { current_page: 142 });
  // a few past reading days so streaks and charts have something to show
  const now = Date.now();
  if (r) for (const d of [1, 2, 3, 5, 6]) await db.addSession({ user_book_id: r.id, started_at: new Date(now - d * 864e5).toISOString(), duration_sec: (12 + d * 3) * 60, start_page: 100 + d, end_page: 112 + d * 2 });
  await refresh();
}
export { today };

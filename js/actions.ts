// Store-level operations: call the db, update the store, keep the UI in step.
import { db, deviceTz } from './db';
import * as store from './store';
import { toast } from './ui';
import { sfx } from './sound';
import { backfill } from './covers';
import type { BookDoc, Profile, ReadingSession, ReadingStatus, ShelfColor, SessionUser, UserBook } from './types';

const QKEY = 'pawsage.queue';
const today = () => new Date().toISOString().slice(0, 10);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export async function refresh() {
  const d = await db.loadAll();
  // sessions still waiting in the offline queue count toward stats
  const q = readQueue().map(s => ({ ...s, id: s._qid, pages_read: Math.max(0, s.end_page - s.start_page) })) as unknown as ReadingSession[];
  store.set({ ...d, sessions: [...q, ...d.sessions], ready: true });
  // books with no cover yet: look for one in the background, remember it on THIS user's row
  backfill(d.books, (ub, url) => { db.updateBook(ub.id, { cover_url: url }).catch(() => {}); }).catch(() => {});
}

export async function boot(session: SessionUser | null) {
  store.set({ session });
  if (!session) { store.set({ profile: null, shelves: [], books: [], sessions: [], ready: false }); return; }
  try {
    await refresh();
    const p = store.get().profile;
    if (p && p.timezone !== deviceTz()) { db.updateProfile({ timezone: deviceTz() }).catch(() => {}); }
    flushQueue();
  } catch (e) { console.warn(e); toast('mochi dropped something. try again?'); sfx.error(); }
}

const run = async <T>(fn: () => Promise<T>, errMsg = 'mochi dropped something. try again?'): Promise<T | null> => {
  try { return await fn(); } catch (e) { console.warn(e); toast(errMsg); sfx.error(); await refresh().catch(() => {}); return null; }
};

/* ---------- books ---------- */
export const addBook = (b: BookDoc, status: ReadingStatus = 'want', shelfId: string | null = null) => run(async () => { const r = await db.addBook(b, status, shelfId); await refresh(); return r; });
export const removeBook = (id: string) => run(async () => { await db.removeBook(id); await refresh(); return true; });

/** Optimistic patch: the screen updates at once, the write follows. */
export function patchBook(id: string, patch: Partial<UserBook>) {
  const s = store.get();
  store.set({ books: s.books.map(b => b.id === id ? { ...b, ...patch, updated_at: new Date().toISOString() } : b) });
  return run(() => db.updateBook(id, patch as Record<string, unknown>));
}

export function setStatus(ub: UserBook, status: ReadingStatus) {
  const patch: Partial<UserBook> = { status };
  const total = ub.book.page_count;
  if (status === 'finished') { patch.finished_at = localToday(); if (total) patch.current_page = total; if (!ub.started_at) patch.started_at = localToday(); }
  if (status === 'reading' && !ub.started_at) patch.started_at = localToday();
  if (status !== 'finished') patch.finished_at = null;
  return patchBook(ub.id, patch);
}

export const setBookShelves = (id: string, shelfIds: string[]) => run(async () => { await db.setShelves(id, shelfIds); await refresh(); });
export const setPages = (ub: UserBook, { total, current }: { total?: number; current?: number }) => run(async () => {
  // page_count is a per-user override on user_books (catalog rows are shared and read-only to us)
  if (total !== undefined) await db.updateBook(ub.id, { page_count: total });
  if (current !== undefined) await db.updateBook(ub.id, { current_page: current });
  await refresh();
});

/* ---------- shelves ---------- */
export const createShelf = (name: string, color: ShelfColor) => run(async () => { const r = await db.createShelf({ name, color, sort_order: store.get().shelves.length }); await refresh(); return r; });
export const updateShelf = (id: string, p: Partial<{ name: string; color: ShelfColor }>) => run(async () => { await db.updateShelf(id, p); await refresh(); });
export const deleteShelf = (id: string) => run(async () => { await db.deleteShelf(id); await refresh(); });
export async function moveShelf(id: string, dir: number) {
  const list = [...store.get().shelves];
  const i = list.findIndex(s => s.id === id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await run(async () => { await Promise.all(list.map((s, k) => s.sort_order === k ? null : db.updateShelf(s.id, { sort_order: k }))); await refresh(); });
}

/* ---------- profile ---------- */
export function patchProfile(p: Partial<Profile>) {
  store.set({ profile: { ...store.get().profile, ...p } as Profile });
  return run(() => db.updateProfile(p));
}

/* ---------- sessions (with an offline queue) ---------- */
interface QueuedSession extends Record<string, unknown> { _qid: string; end_page: number; start_page: number }
const readQueue = (): QueuedSession[] => { try { return JSON.parse(localStorage.getItem(QKEY) || '') as QueuedSession[] || []; } catch { return []; } };
const writeQueue = (q: QueuedSession[]) => { try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch { /* ignore */ } };

export async function saveSession(s: Record<string, unknown>) {
  try {
    await db.addSession(s);
  } catch (e) {
    console.warn('queued session', e);
    writeQueue([...readQueue(), { ...s, _qid: crypto.randomUUID() } as QueuedSession]);
  }
  await refresh().catch(() => {});
}

export async function flushQueue() {
  const q = readQueue();
  if (!q.length || !store.get().online) return;
  const left: QueuedSession[] = [];
  for (const { _qid, ...s } of q) { try { await db.addSession(s); } catch { left.push({ ...s, _qid }); } }
  writeQueue(left);
  if (left.length !== q.length) refresh().catch(() => {});
}

/* ---------- selectors ---------- */
export const currentBook = (): UserBook | null => store.get().books.find(b => b.status === 'reading') || null;
export const bookById = (id: string): UserBook | null => store.get().books.find(b => b.id === id) || null;
export const firstName = () => (store.get().profile?.display_name || 'reader').split(/[\s@]/)[0];

export async function loadSample() {
  const demo: (BookDoc & { st: ReadingStatus })[] = [
    { key: '/works/s1', title: 'Why Nations Fail', cover_i: 7253519, isbn: '9780307719225', authors: ['Daron Acemoglu', 'James A. Robinson'], first_publish_year: 2012, page_count: 464, st: 'reading' },
    { key: '/works/s2', title: 'Americanah', cover_i: 8474037, isbn: '9780307455925', authors: ['Chimamanda Ngozi Adichie'], first_publish_year: 2013, page_count: 477, st: 'want' },
    { key: '/works/s3', title: 'Sapiens', cover_i: 8634250, isbn: '9780062316097', authors: ['Yuval Noah Harari'], first_publish_year: 2011, page_count: 443, st: 'want' },
    { key: '/works/s4', title: 'Kintu', cover_i: 9185181, isbn: '9781617756177', authors: ['Jennifer Nansubuga Makumbi'], first_publish_year: 2014, page_count: 448, st: 'want' },
    { key: '/works/s5', title: 'Dune', cover_i: 11481354, isbn: '9780441013593', authors: ['Frank Herbert'], first_publish_year: 1965, page_count: 612, st: 'finished' },
    { key: '/works/s6', title: 'Atomic Habits', cover_i: 12539702, isbn: '9780735211292', authors: ['James Clear'], first_publish_year: 2018, page_count: 320, st: 'finished' },
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

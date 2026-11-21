// All data access lives here. Two interchangeable backends with the same shapes:
//   supabase: real accounts, Postgres, RLS (used when config.js has a URL and key)
//   demo:     localStorage on this device (used otherwise)
// The Supabase client is imported lazily so demo mode never downloads it.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BookDoc, CatalogBook, Profile, ReadingSession, SessionUser, Shelf, ShelfColor, UserBook } from './types';

export const live = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const mode = live ? 'supabase' : 'demo';

let sb: SupabaseClient | null = null;
let sbPromise: Promise<SupabaseClient> | null = null;
async function client(): Promise<SupabaseClient> {
  if (sb) return sb;
  if (!sbPromise) sbPromise = import('@supabase/supabase-js').then(({ createClient }) => {
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
    return sb;
  });
  return sbPromise;
}

const uuid = () => crypto.randomUUID();
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let uid: string | null = null;

/** Merge a reader's per-book overrides into the shared catalog row. */
const joinBook = (u: Record<string, unknown>, catalog: Map<string, CatalogBook>): UserBook | null => {
  const base = catalog.get(u.book_id as string);
  if (!base) return null;
  return {
    ...(u as unknown as UserBook),
    book: {
      ...base,
      cover_url: (u.cover_url as string | null | undefined) ?? base.cover_url,
      page_count: (u.page_count as number | null | undefined) ?? base.page_count,
    },
    shelf_ids: (u.shelf_ids as string[]) || [],
  };
};

/* ======================== demo backend ======================== */
interface DemoData {
  profile: Profile | null;
  shelves: Shelf[];
  catalog: CatalogBook[];
  user_books: Record<string, unknown>[];
  shelf_books: { shelf_id: string; user_book_id: string }[];
  sessions: ReadingSession[];
}
const LKEY = 'pawsage.demo.v1';
const blank = (): DemoData => ({ profile: null, shelves: [], catalog: [], user_books: [], shelf_books: [], sessions: [] });
let L: DemoData;
try { L = JSON.parse(localStorage.getItem(LKEY) || '') as DemoData || blank(); } catch { L = blank(); }
const lsave = () => { try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch { /* storage full or blocked */ } };

const demo = {
  async init() {
    const s = L.profile ? { user: { id: 'demo', email: null }, demo: true } : null;
    uid = s ? 'demo' : null;
    return s;
  },
  async start(name: string, reminder: boolean) {
    L.profile = {
      id: 'demo', display_name: name || 'reader', timezone: tz(), yearly_goal: 12,
      daily_goal_pages: 10, daily_goal_minutes: 20,
      reminder_time: reminder ? '21:00:00' : null, onboarded_at: new Date().toISOString(),
    };
    L.shelves = L.shelves.length ? L.shelves : [{ id: uuid(), name: 'Reading list', color: 'rose', sort_order: 0 }];
    lsave(); uid = 'demo';
    return { user: { id: 'demo', email: null }, demo: true };
  },
  async signOut() { /* keep the data so signing back in restores it */ uid = null; },
  async loadAll() {
    const catalog = new Map(L.catalog.map(b => [b.id, b]));
    const sbooks = new Map<string, string[]>();
    L.shelf_books.forEach(r => { const list = sbooks.get(r.user_book_id) || []; list.push(r.shelf_id); sbooks.set(r.user_book_id, list); });
    return {
      profile: L.profile,
      shelves: [...L.shelves].sort((a, b) => a.sort_order - b.sort_order),
      books: L.user_books.map(u => joinBook({ ...u, shelf_ids: sbooks.get(u.id as string) || [] }, catalog)).filter((b): b is UserBook => !!b).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')),
      sessions: [...L.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)),
    };
  },
  async updateProfile(p: Partial<Profile>) { if (L.profile) Object.assign(L.profile, p); lsave(); },
  async createShelf({ name, color }: { name: string; color: ShelfColor }) { const s: Shelf = { id: uuid(), name, color, sort_order: L.shelves.length }; L.shelves.push(s); lsave(); return s; },
  async updateShelf(id: string, p: Partial<Shelf>) { Object.assign(L.shelves.find(s => s.id === id), p); lsave(); },
  async deleteShelf(id: string) { L.shelves = L.shelves.filter(s => s.id !== id); L.shelf_books = L.shelf_books.filter(r => r.shelf_id !== id); lsave(); },
  async addBook(b: BookDoc, status: string, shelfId: string | null) {
    let cat = (b.key && L.catalog.find(c => c.ol_work_key === b.key)) || (!b.key && L.catalog.find(c => !c.ol_work_key && c.title.toLowerCase() === b.title.toLowerCase()));
    if (!cat) {
      cat = {
        id: uuid(), ol_work_key: b.key || null, ol_cover_id: b.cover_i || null, isbn13: (b.isbn13 || b.isbn) || null,
        cover_url: b.cover_url || null, title: b.title, authors: b.authors || [],
        first_publish_year: b.first_publish_year || null, page_count: b.page_count || null,
      };
      L.catalog.push(cat);
    }
    let ub = L.user_books.find(u => u.book_id === cat!.id) as (Record<string, unknown> & { id: string }) | undefined;
    const duplicate = !!ub;
    if (!ub) {
      const now = new Date().toISOString();
      ub = {
        id: uuid(), book_id: cat.id, status, rating: null, current_page: 0,
        started_at: status === 'reading' ? today() : null,
        finished_at: status === 'finished' ? today() : null,
        is_favorite: false, notes: '', cover_url: null,
        page_count: status === 'finished' && cat.page_count ? cat.page_count : null,
        created_at: now, updated_at: now,
      };
      L.user_books.push(ub);
    }
    if (shelfId && !L.shelf_books.some(r => r.shelf_id === shelfId && r.user_book_id === ub.id)) L.shelf_books.push({ shelf_id: shelfId, user_book_id: ub.id });
    lsave();
    return { id: ub.id, duplicate };
  },
  async updateBook(id: string, p: Record<string, unknown>) { const u = L.user_books.find(x => x.id === id); if (u) Object.assign(u, p, { updated_at: new Date().toISOString() }); lsave(); },
  async removeBook(id: string) { L.user_books = L.user_books.filter(u => u.id !== id); L.shelf_books = L.shelf_books.filter(r => r.user_book_id !== id); L.sessions = L.sessions.filter(s => s.user_book_id !== id); lsave(); },
  async setShelves(id: string, shelfIds: string[]) { L.shelf_books = L.shelf_books.filter(r => r.user_book_id !== id).concat(shelfIds.map(s => ({ shelf_id: s, user_book_id: id }))); lsave(); },
  async addSession(s: Record<string, unknown>) {
    const row = { id: uuid(), ...s, pages_read: Math.max(0, (s.end_page as number) - (s.start_page as number)) } as ReadingSession;
    L.sessions.push(row);
    const ub = L.user_books.find(u => u.id === s.user_book_id) as Record<string, unknown> | undefined;
    if (ub) {
      ub.current_page = Math.max(ub.current_page as number, row.end_page);
      if (ub.status === 'want' || ub.status === 'paused') ub.status = 'reading';
      ub.started_at = ub.started_at || today();
      ub.updated_at = new Date().toISOString();
      ub.page_count = ub.page_count ?? null;
    }
    lsave(); return row;
  },
  exportAll: async () => L,
  async wipe() { L = blank(); lsave(); },
};

/* ======================== supabase backend ======================== */
// Supabase query builders are PromiseLike (thenable), not Promise instances.
const q = async <T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> => {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
};

const remote = {
  async init() {
    const c = await client();
    const { data } = await c.auth.getSession();
    uid = data.session?.user.id ?? null;
    return data.session ? { user: { id: uid!, email: data.session.user.email ?? null }, demo: false } : null;
  },
  async onAuth(cb: (s: { user: { id: string; email: string | null }; demo: boolean } | null) => void) {
    const c = await client();
    return c.auth.onAuthStateChange((_e, s) => {
      uid = s?.user.id ?? null;
      cb(s ? { user: { id: uid!, email: s.user.email ?? null }, demo: false } : null);
    });
  },
  async signInEmail(email: string) {
    const c = await client();
    const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
  },
  async verifyCode(email: string, token: string) {
    const c = await client();
    const { error } = await c.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  },
  async signInGoogle() {
    const c = await client();
    const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) throw error;
  },
  async signOut() { const c = await client(); await c.auth.signOut(); },
  async loadAll() {
    const c = await client();
    const since = new Date(Date.now() - 400 * 864e5).toISOString();
    const [profile, shelves, ubs, sessions] = await Promise.all([
      q<Profile | null>(c.from('profiles').select('*').eq('id', uid).maybeSingle()),
      q<Shelf[]>(c.from('shelves').select('*').order('sort_order')),
      q<Record<string, unknown>[]>(c.from('user_books').select('*, book:books(*), shelf_books(shelf_id)').order('updated_at', { ascending: false })),
      q<ReadingSession[]>(c.from('reading_sessions').select('*').gte('started_at', since).order('started_at', { ascending: false }).limit(5000)),
    ]);
    const catalog = new Map<string, CatalogBook>();
    const books = ubs.map(u => {
      const b = u.book as CatalogBook;
      if (b?.id) catalog.set(b.id, b);
      return u;
    }).map(u => ({
      ...u,
      shelf_ids: ((u.shelf_books as { shelf_id: string }[] | undefined) || []).map(r => r.shelf_id),
    }));
    return { profile, shelves, books: books.map(u => joinBook(u, catalog)).filter((b): b is UserBook => !!b), sessions };
  },
  async updateProfile(p: Partial<Profile>) { const c = await client(); await q(c.from('profiles').update(p).eq('id', uid)); },
  async createShelf({ name, color, sort_order }: { name: string; color: ShelfColor; sort_order: number }) {
    const c = await client();
    return q<Shelf>(c.from('shelves').insert({ user_id: uid, name, color, sort_order }).select().single());
  },
  async updateShelf(id: string, p: Partial<Shelf>) { const c = await client(); await q(c.from('shelves').update(p).eq('id', id)); },
  async deleteShelf(id: string) { const c = await client(); await q(c.from('shelves').delete().eq('id', id)); },
  async addBook(b: BookDoc, status: string, shelfId: string | null) {
    const c = await client();
    let cat: CatalogBook | null = null;
    if (b.key) cat = await q<CatalogBook | null>(c.from('books').select('*').eq('ol_work_key', b.key).maybeSingle());
    if (!cat) {
      const row: Record<string, unknown> = {
        ol_work_key: b.key || null, ol_cover_id: b.cover_i || null, isbn13: (b.isbn13 || b.isbn) || null,
        title: b.title, authors: b.authors || [], first_publish_year: b.first_publish_year || null,
        page_count: b.page_count || null, created_by: uid,
      };
      if (b.cover_url) row.cover_url = b.cover_url;
      const { data, error } = await c.from('books').insert(row).select().single();
      if (error && b.key) cat = await q<CatalogBook>(c.from('books').select('*').eq('ol_work_key', b.key).single()); // lost a race to another reader, reuse their row
      else if (error) throw error; else cat = data as CatalogBook;
    }
    const existing = await q<{ id: string } | null>(c.from('user_books').select('id').eq('book_id', cat!.id).maybeSingle());
    let id = existing?.id, duplicate = !!existing;
    if (!id) {
      const row = {
        user_id: uid, book_id: cat!.id, status,
        started_at: status === 'reading' ? today() : null,
        finished_at: status === 'finished' ? today() : null,
        page_count: status === 'finished' && cat!.page_count ? cat!.page_count : null,
      };
      id = (await q<{ id: string }>(c.from('user_books').insert(row).select('id').single())).id;
    }
    if (shelfId) await q(c.from('shelf_books').upsert({ shelf_id: shelfId, user_book_id: id }));
    return { id, duplicate };
  },
  async updateBook(id: string, p: Record<string, unknown>) { const c = await client(); await q(c.from('user_books').update(p).eq('id', id)); },
  async removeBook(id: string) { const c = await client(); await q(c.from('user_books').delete().eq('id', id)); },
  async setShelves(id: string, shelfIds: string[]) {
    const c = await client();
    await q(c.from('shelf_books').delete().eq('user_book_id', id));
    if (shelfIds.length) await q(c.from('shelf_books').insert(shelfIds.map(s => ({ shelf_id: s, user_book_id: id }))));
  },
  async addSession(s: Record<string, unknown>) {
    const c = await client();
    return q<ReadingSession>(c.from('reading_sessions').insert({ user_id: uid, ...s }).select().single());
  },
  exportAll: async () => remote.loadAll(),
};

/** One flat interface so callers never need to know which backend is active. */
export interface Backend {
  init(): Promise<SessionUser | null>;
  onAuth?(cb: (s: SessionUser | null) => void): Promise<unknown>;
  start?(name: string, reminder: boolean): Promise<SessionUser>;
  signInEmail?(email: string): Promise<void>;
  verifyCode?(email: string, token: string): Promise<void>;
  signInGoogle?(): Promise<void>;
  signOut(): Promise<void>;
  loadAll(): Promise<{ profile: Profile | null; shelves: Shelf[]; books: UserBook[]; sessions: ReadingSession[] }>;
  updateProfile(p: Partial<Profile>): Promise<unknown>;
  createShelf(a: { name: string; color: ShelfColor; sort_order?: number }): Promise<Shelf>;
  updateShelf(id: string, p: Partial<Shelf>): Promise<unknown>;
  deleteShelf(id: string): Promise<unknown>;
  addBook(b: BookDoc, status: string, shelfId: string | null): Promise<{ id: string; duplicate: boolean }>;
  updateBook(id: string, p: Record<string, unknown>): Promise<unknown>;
  removeBook(id: string): Promise<unknown>;
  setShelves(id: string, shelfIds: string[]): Promise<unknown>;
  addSession(s: Record<string, unknown>): Promise<ReadingSession>;
  exportAll(): Promise<unknown>;
  wipe?(): Promise<void>;
}

export const db: Backend = live ? remote : demo;
export const deviceTz = tz;

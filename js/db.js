// All data access lives here. Two interchangeable backends with the same shapes:
//   supabase: real accounts, Postgres, RLS (used when config.js has a URL and key)
//   demo:     localStorage on this device (used otherwise)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const live = !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
export const mode = live ? 'supabase' : 'demo';
const sb = live ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null;

const uuid = () => crypto.randomUUID();
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let uid = null;

/* ======================== demo backend ======================== */
const LKEY = 'pawsage.demo.v1';
const blank = () => ({ profile: null, shelves: [], catalog: [], user_books: [], shelf_books: [], sessions: [] });
let L;
try { L = JSON.parse(localStorage.getItem(LKEY)) || blank(); } catch { L = blank(); }
const lsave = () => { try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch { /* storage full or blocked */ } };

const demo = {
  async init() {
    const s = L.profile ? { user: { id: 'demo', email: null }, demo: true } : null;
    uid = s ? 'demo' : null;
    return s;
  },
  async start(name, reminder) {
    L.profile = { id: 'demo', display_name: name || 'reader', timezone: tz(), yearly_goal: 12, daily_goal_pages: 10, daily_goal_minutes: 20, reminder_time: reminder ? '21:00:00' : null, onboarded_at: new Date().toISOString() };
    L.shelves = L.shelves.length ? L.shelves : [
      { id: uuid(), name: 'Reading list', color: 'rose', sort_order: 0 },
    ];
    lsave(); uid = 'demo';
    return { user: { id: 'demo', email: null }, demo: true };
  },
  async signOut() { /* keep the data so signing back in restores it */ uid = null; },
  async loadAll() {
    const catalog = new Map(L.catalog.map(b => [b.id, b]));
    const sbooks = new Map();
    L.shelf_books.forEach(r => { (sbooks.get(r.user_book_id) || sbooks.set(r.user_book_id, []).get(r.user_book_id)).push(r.shelf_id); });
    return {
      profile: L.profile,
      shelves: [...L.shelves].sort((a, b) => a.sort_order - b.sort_order),
      books: L.user_books.map(u => ({ ...u, book: catalog.get(u.book_id), shelf_ids: sbooks.get(u.id) || [] })).filter(b => b.book).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      sessions: [...L.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)),
    };
  },
  async updateProfile(p) { Object.assign(L.profile, p); lsave(); },
  async createShelf({ name, color }) { const s = { id: uuid(), name, color, sort_order: L.shelves.length }; L.shelves.push(s); lsave(); return s; },
  async updateShelf(id, p) { Object.assign(L.shelves.find(s => s.id === id), p); lsave(); },
  async deleteShelf(id) { L.shelves = L.shelves.filter(s => s.id !== id); L.shelf_books = L.shelf_books.filter(r => r.shelf_id !== id); lsave(); },
  async addBook(b, status, shelfId) {
    let cat = (b.key && L.catalog.find(c => c.ol_work_key === b.key)) || L.catalog.find(c => !b.key && !c.ol_work_key && c.title.toLowerCase() === b.title.toLowerCase());
    if (!cat) {
      cat = { id: uuid(), ol_work_key: b.key || null, ol_cover_id: b.cover_i || null, isbn13: b.isbn || null, cover_url: b.cover_url || null, title: b.title, authors: b.authors || [], first_publish_year: b.first_publish_year || null, page_count: b.page_count || null };
      L.catalog.push(cat);
    }
    let ub = L.user_books.find(u => u.book_id === cat.id), duplicate = !!ub;
    if (!ub) {
      const now = new Date().toISOString();
      ub = { id: uuid(), book_id: cat.id, status, rating: null, current_page: 0, started_at: status === 'reading' ? today() : null, finished_at: status === 'finished' ? today() : null, is_favorite: false, notes: '', created_at: now, updated_at: now };
      if (status === 'finished' && cat.page_count) ub.current_page = cat.page_count;
      L.user_books.push(ub);
    }
    if (shelfId && !L.shelf_books.some(r => r.shelf_id === shelfId && r.user_book_id === ub.id)) L.shelf_books.push({ shelf_id: shelfId, user_book_id: ub.id });
    lsave();
    return { id: ub.id, duplicate };
  },
  async updateBook(id, p) { Object.assign(L.user_books.find(u => u.id === id), p, { updated_at: new Date().toISOString() }); lsave(); },
  async updateCatalog(bookId, p) { Object.assign(L.catalog.find(c => c.id === bookId), p); lsave(); },
  async removeBook(id) { L.user_books = L.user_books.filter(u => u.id !== id); L.shelf_books = L.shelf_books.filter(r => r.user_book_id !== id); L.sessions = L.sessions.filter(s => s.user_book_id !== id); lsave(); },
  async setShelves(id, shelfIds) { L.shelf_books = L.shelf_books.filter(r => r.user_book_id !== id).concat(shelfIds.map(s => ({ shelf_id: s, user_book_id: id }))); lsave(); },
  async addSession(s) {
    const row = { id: uuid(), ...s, pages_read: Math.max(0, s.end_page - s.start_page) };
    L.sessions.push(row);
    const ub = L.user_books.find(u => u.id === s.user_book_id);
    if (ub) {
      ub.current_page = Math.max(ub.current_page, s.end_page);
      if (ub.status === 'want' || ub.status === 'paused') ub.status = 'reading';
      ub.started_at = ub.started_at || today();
      ub.updated_at = new Date().toISOString();
    }
    lsave(); return row;
  },
  exportAll: async () => L,
  async wipe() { L = blank(); lsave(); },
};

/* ======================== supabase backend ======================== */
const q = async p => { const { data, error } = await p; if (error) throw error; return data; };

const remote = {
  async init() {
    const { data } = await sb.auth.getSession();
    uid = data.session?.user.id ?? null;
    return data.session ? { user: { id: uid, email: data.session.user.email }, demo: false } : null;
  },
  onAuth(cb) { return sb.auth.onAuthStateChange((_e, s) => { uid = s?.user.id ?? null; cb(s ? { user: { id: uid, email: s.user.email }, demo: false } : null); }); },
  async signInEmail(email) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
  },
  async verifyCode(email, token) {
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  },
  async signInGoogle() { const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); if (error) throw error; },
  async signOut() { await sb.auth.signOut(); },
  async loadAll() {
    const since = new Date(Date.now() - 400 * 864e5).toISOString();
    const [profile, shelves, ubs, sessions] = await Promise.all([
      q(sb.from('profiles').select('*').eq('id', uid).maybeSingle()),
      q(sb.from('shelves').select('*').order('sort_order')),
      q(sb.from('user_books').select('*, book:books(*), shelf_books(shelf_id)').order('updated_at', { ascending: false })),
      q(sb.from('reading_sessions').select('*').gte('started_at', since).order('started_at', { ascending: false }).limit(5000)),
    ]);
    return { profile, shelves, books: ubs.map(u => ({ ...u, shelf_ids: (u.shelf_books || []).map(r => r.shelf_id) })), sessions };
  },
  async updateProfile(p) { await q(sb.from('profiles').update(p).eq('id', uid)); },
  async createShelf({ name, color, sort_order }) { return q(sb.from('shelves').insert({ user_id: uid, name, color, sort_order }).select().single()); },
  async updateShelf(id, p) { await q(sb.from('shelves').update(p).eq('id', id)); },
  async deleteShelf(id) { await q(sb.from('shelves').delete().eq('id', id)); },
  async addBook(b, status, shelfId) {
    let cat = null;
    if (b.key) cat = await q(sb.from('books').select('*').eq('ol_work_key', b.key).maybeSingle());
    if (!cat) {
      const row = { ol_work_key: b.key || null, ol_cover_id: b.cover_i || null, isbn13: b.isbn || null, title: b.title, authors: b.authors || [], first_publish_year: b.first_publish_year || null, page_count: b.page_count || null, created_by: uid };
      if (b.cover_url) row.cover_url = b.cover_url; // needs supabase/migrations/0002_covers.sql (already in schema.sql)
      const { data, error } = await sb.from('books').insert(row).select().single();
      if (error && b.key) cat = await q(sb.from('books').select('*').eq('ol_work_key', b.key).single()); // lost a race to another user, reuse their row
      else if (error) throw error; else cat = data;
    }
    const existing = await q(sb.from('user_books').select('id').eq('book_id', cat.id).maybeSingle());
    let id = existing?.id, duplicate = !!existing;
    if (!id) {
      const row = { user_id: uid, book_id: cat.id, status, started_at: status === 'reading' ? today() : null, finished_at: status === 'finished' ? today() : null, current_page: status === 'finished' && cat.page_count ? cat.page_count : 0 };
      id = (await q(sb.from('user_books').insert(row).select('id').single())).id;
    }
    if (shelfId) await sb.from('shelf_books').upsert({ shelf_id: shelfId, user_book_id: id });
    return { id, duplicate };
  },
  async updateBook(id, p) { await q(sb.from('user_books').update(p).eq('id', id)); },
  async updateCatalog(bookId, p) { await q(sb.from('books').update(p).eq('id', bookId)); },
  async removeBook(id) { await q(sb.from('user_books').delete().eq('id', id)); },
  async setShelves(id, shelfIds) {
    await q(sb.from('shelf_books').delete().eq('user_book_id', id));
    if (shelfIds.length) await q(sb.from('shelf_books').insert(shelfIds.map(s => ({ shelf_id: s, user_book_id: id }))));
  },
  async addSession(s) { return q(sb.from('reading_sessions').insert({ user_id: uid, ...s }).select().single()); },
  exportAll: async () => remote.loadAll(),
};

export const db = live ? remote : demo;
export const demoBackend = demo;
export const deviceTz = tz;

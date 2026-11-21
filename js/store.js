const state = {
  session: null,     // { user:{id,email}, demo:boolean }
  profile: null,
  shelves: [],
  books: [],         // user_books joined with catalog book + shelf_ids
  sessions: [],      // reading sessions, newest first
  online: navigator.onLine,
  ready: false,
};
const subs = new Set();

export const get = () => state;
export const set = patch => { Object.assign(state, patch); subs.forEach(f => f(state)); };
export const subscribe = f => { subs.add(f); return () => subs.delete(f); };

export const prefs = {
  get(k, d = null) { try { const v = localStorage.getItem('pawsage.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pawsage.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

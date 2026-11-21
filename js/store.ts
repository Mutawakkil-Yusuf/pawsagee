import type { StoreState } from './types';

const state: StoreState = {
  session: null,     // { user:{id,email}, demo:boolean }
  profile: null,
  shelves: [],
  books: [],         // user_books joined with catalog book + shelf_ids
  sessions: [],      // reading sessions, newest first
  online: navigator.onLine,
  ready: false,
};

const subs = new Set<(s: StoreState) => void>();

export const get = (): StoreState => state;
export const set = (patch: Partial<StoreState>) => { Object.assign(state, patch); subs.forEach(f => f(state)); };
export const subscribe = (f: (s: StoreState) => void) => { subs.add(f); return () => subs.delete(f); };

export const prefs = {
  get<T = unknown>(k: string, d: T | null = null): T | null {
    try { const v = localStorage.getItem('pawsage.' + k); return v === null ? d : JSON.parse(v) as T; } catch { return d; }
  },
  set(k: string, v: unknown) { try { localStorage.setItem('pawsage.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

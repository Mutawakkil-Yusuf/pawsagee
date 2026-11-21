// Cover resolution. A book can have a cover from several places; we try them in order and fall back to a generated cover.
//   1. Open Library by cover id   2. a stored cover_url   3. Google Books (looked up by ISBN or title+author)   4. Open Library by ISBN
import { escape } from './html';
import { googleCover } from './openlibrary';
import type { BookDoc, CatalogBook, UserBook } from './types';

const KEY = 'pawsage.covers.v1';
const RETRY_MS = 3 * 864e5;
interface CoverCache { [k: string]: { u: string | null; t: number } }
let map: CoverCache = {};
try { map = JSON.parse(localStorage.getItem(KEY) || '') as CoverCache || {}; } catch { map = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* storage full */ } };

const ck = (b: BookDoc) => b.isbn13 || b.isbn ? 'i' + (b.isbn13 || b.isbn) : 't' + (b.title + '|' + ((b.authors || [])[0] || '')).toLowerCase();
export const cachedGoogle = (b: BookDoc) => map[ck(b)]?.u || null;

export const olById = (id: number, size = 'M') => `https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false`;
export const olByIsbn = (isbn: string, size = 'M') => `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-${size}.jpg?default=false`;

/** Either a catalog row or a normalized search result. */
export interface CoverSource {
  title: string;
  authors?: string[];
  ol_cover_id?: number | null;
  cover_i?: number | null;
  cover_url?: string | null;
  isbn?: string | null;
  isbn13?: string | null;
}

/** Image URLs to try, best first. */
export function candidates(b: CoverSource, size = 'M'): string[] {
  const c: string[] = [];
  const coverId = b.ol_cover_id ?? b.cover_i;
  if (coverId) c.push(olById(coverId, size));
  if (b.cover_url) c.push(b.cover_url);
  const g = cachedGoogle(b); if (g && !c.includes(g)) c.push(g);
  const isbn = b.isbn13 || b.isbn; if (isbn) c.push(olByIsbn(isbn, size));
  return c;
}

const inflight = new Map<string, Promise<string | null>>();
/** Look a cover up on Google Books. Cached per device, misses are retried after 3 days. */
export async function findCover(b: BookDoc): Promise<string | null> {
  const k = ck(b), hit = map[k];
  if (hit && (hit.u || Date.now() - hit.t < RETRY_MS)) return hit.u;
  if (inflight.has(k)) return inflight.get(k)!;
  const p = googleCover(b).then(u => { map[k] = { u: u || null, t: Date.now() }; save(); return u; }).catch(() => null).finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

/** Put a found image into every cover on screen for this book. */
export function applyCover(bid: string, url: string) {
  document.querySelectorAll<HTMLElement>('.cover').forEach(p => {
    if (p.dataset.bid !== bid) return;
    if (p.querySelector('.cover-img')) { // an image is still loading: queue this one behind it
      const q = (p.dataset.srcs || '').split('|').filter(Boolean);
      if (!q.includes(url)) p.dataset.srcs = [...q, url].join('|');
      return;
    }
    p.dataset.srcs = '';
    p.innerHTML = `<img class="cover-img" src="${escape(url)}" alt="" decoding="async">`;
  });
}

/** After loading the library: find covers for books that have none, a few at a time. */
export async function backfill(books: UserBook[], persist: (ub: UserBook, url: string) => void) {
  const todo = books.filter(u => !u.book.ol_cover_id && !u.book.cover_url && !cachedGoogle(u.book)).slice(0, 12);
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const u = todo[i++];
      const url = await findCover(u.book);
      if (url) { applyCover(u.book.id, url); persist?.(u, url); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

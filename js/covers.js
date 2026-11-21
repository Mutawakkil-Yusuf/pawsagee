// Cover resolution. A book can have a cover from several places; we try them in order and fall back to a generated cover.
//   1. Open Library by cover id   2. a stored cover_url   3. Google Books (looked up by ISBN or title+author)   4. Open Library by ISBN
import { escape } from './html.js';
import { googleCover } from './openlibrary.js';

const KEY = 'pawsage.covers.v1';
const RETRY_MS = 3 * 864e5;
let map = {};
try { map = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { map = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* storage full */ } };

const ck = b => b.isbn13 || b.isbn ? 'i' + (b.isbn13 || b.isbn) : 't' + (b.title + '|' + ((b.authors || [])[0] || '')).toLowerCase();
export const cachedGoogle = b => map[ck(b)]?.u || null;

export const olById = (id, size = 'M') => `https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false`;
export const olByIsbn = (isbn, size = 'M') => `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`;

/** Image URLs to try, best first. */
export function candidates(b, size = 'M') {
  const c = [];
  if (b.ol_cover_id) c.push(olById(b.ol_cover_id, size));
  if (b.cover_url) c.push(b.cover_url);
  const g = cachedGoogle(b); if (g && !c.includes(g)) c.push(g);
  const isbn = b.isbn13 || b.isbn; if (isbn) c.push(olByIsbn(isbn, size));
  return c;
}

const inflight = new Map();
/** Look a cover up on Google Books. Cached per device, misses are retried after 3 days. */
export async function findCover(b) {
  const k = ck(b), hit = map[k];
  if (hit && (hit.u || Date.now() - hit.t < RETRY_MS)) return hit.u;
  if (inflight.has(k)) return inflight.get(k);
  const p = googleCover(b).then(u => { map[k] = { u: u || null, t: Date.now() }; save(); return u; }).catch(() => null).finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

/** Put a found image into every cover on screen for this book. */
export function applyCover(bid, url) {
  document.querySelectorAll('.cover').forEach(p => {
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
export async function backfill(books, persist) {
  const todo = books.filter(u => !u.book.ol_cover_id && !u.book.cover_url && !cachedGoogle(u.book)).slice(0, 12);
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const u = todo[i++];
      const url = await findCover(u.book);
      if (url) { applyCover(u.book.id, url); persist?.(u.book, url); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

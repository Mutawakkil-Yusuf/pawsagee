// Book data. Open Library first (no key needed), Google Books as a backup for search, ISBN lookups and covers.
import type { BookDoc } from './types';

const OL = 'https://openlibrary.org';
const GB = 'https://www.googleapis.com/books/v1/volumes';
const FIELDS = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,isbn,ia';
const GFIELDS = 'items(id,volumeInfo(title,authors,publishedDate,pageCount,imageLinks,industryIdentifiers))';
const cache = new Map<string, BookDoc[]>();

const thumb = (l?: { thumbnail?: string; smallThumbnail?: string }) => { const u = l?.thumbnail || l?.smallThumbnail; return u ? u.replace('http://', 'https://').replace('&edge=curl', '') : null; };
const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

interface GoogleVolume {
  volumeInfo?: {
    title?: string; authors?: string[]; publishedDate?: string; pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

function gDoc(v: GoogleVolume): BookDoc | null {
  const i = v.volumeInfo || {};
  if (!i.title) return null;
  const ids = i.industryIdentifiers || [];
  const isbn = (ids.find(x => x.type === 'ISBN_13') || ids.find(x => x.type === 'ISBN_10'))?.identifier || null;
  return {
    key: null, title: i.title, authors: (i.authors || []).slice(0, 3),
    first_publish_year: +(i.publishedDate || '').slice(0, 4) || null,
    cover_i: null, cover_url: thumb(i.imageLinks), page_count: i.pageCount || null, isbn,
  };
}

async function googleList(q: string, { signal, max = 12 }: { signal?: AbortSignal; max?: number } = {}): Promise<BookDoc[]> {
  const r = await fetch(`${GB}?q=${encodeURIComponent(q)}&maxResults=${max}&printType=books&fields=${encodeURIComponent(GFIELDS)}`, { signal });
  if (!r.ok) throw new Error('google failed');
  return (((await r.json()) as { items?: GoogleVolume[] }).items || []).map(gDoc).filter((d): d is BookDoc => !!d);
}

interface OlDoc { key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number; number_of_pages_median?: number; isbn?: string[]; ia?: string[] }
async function olSearch(q: string, { signal }: { signal?: AbortSignal } = {}): Promise<BookDoc[]> {
  const r = await fetch(`${OL}/search.json?q=${encodeURIComponent(q)}&limit=12&fields=${FIELDS}`, { signal });
  if (!r.ok) throw new Error('search failed');
  return (((await r.json()) as { docs?: OlDoc[] }).docs ?? []).filter(d => d.title).map(d => ({
    key: d.key, title: d.title, authors: d.author_name?.slice(0, 3) ?? [],
    first_publish_year: d.first_publish_year ?? null, cover_i: d.cover_i ?? null, cover_url: null,
    page_count: d.number_of_pages_median ?? null, isbn: d.isbn?.[0] ?? null, ia: d.ia?.slice(0, 20) ?? [],
  }));
}

export async function search(q: string, { signal }: { signal?: AbortSignal } = {}): Promise<BookDoc[]> {
  q = q.trim();
  if (q.length < 2) return [];
  if (cache.has(q)) return cache.get(q)!;
  let docs: BookDoc[] | null = null, failed: unknown = null;
  try { docs = await olSearch(q, { signal }); } catch (e) { if (e instanceof Error && e.name === 'AbortError') throw e; failed = e; }
  if (!docs || docs.length < 4) {
    try {
      const g = await googleList(q, { signal });
      const have = new Set((docs || []).map(d => norm(d.title)));
      docs = [...(docs || []), ...g.filter(d => !have.has(norm(d.title)))].slice(0, 12);
    } catch (e) { if (e instanceof Error && e.name === 'AbortError') throw e; if (!docs) throw failed || e; }
  }
  cache.set(q, docs);
  return docs;
}

export async function byIsbn(raw: string): Promise<BookDoc | null> {
  const isbn = raw.replace(/[^0-9Xx]/g, '');
  if (isbn.length < 10) return null;
  try { const d = (await olSearch(`isbn:${isbn}`))[0]; if (d) return { ...d, isbn }; } catch { /* try google */ }
  try { const d = (await googleList(`isbn:${isbn}`, { max: 1 }))[0]; if (d) return { ...d, isbn }; } catch { /* nothing */ }
  return null;
}

/** A cover from Google Books for a book we have no image for. */
export async function googleCover(b: BookDoc): Promise<string | null> {
  const isbn = b.isbn13 || b.isbn;
  const author = (b.authors || [])[0];
  const q = isbn ? `isbn:${isbn}` : `intitle:"${b.title}"${author ? `+inauthor:"${author}"` : ''}`;
  const list = await googleList(q, { max: 4 });
  const want = norm(b.title);
  const hit = list.find(d => d.cover_url && (isbn || norm(d.title).startsWith(want.slice(0, 14)) || want.startsWith(norm(d.title).slice(0, 14))));
  return hit?.cover_url || null;
}


/** Cover id from Open Library search by ISBN. Used when Google Books is rate-limited. */
export async function olCoverForIsbn(isbn: string): Promise<string | null> {
  try {
    const docs = await olSearch(`isbn:${isbn}`);
    const id = docs.find(d => d.cover_i)?.cover_i;
    return id ? `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false` : null;
  } catch { return null; }
}

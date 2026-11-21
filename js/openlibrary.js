// Book data. Open Library first (no key needed), Google Books as a backup for search, ISBN lookups and covers.
const OL = 'https://openlibrary.org';
const GB = 'https://www.googleapis.com/books/v1/volumes';
const FIELDS = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,isbn';
const GFIELDS = 'items(id,volumeInfo(title,authors,publishedDate,pageCount,imageLinks,industryIdentifiers))';
const cache = new Map();

const thumb = l => { const u = l?.thumbnail || l?.smallThumbnail; return u ? u.replace('http://', 'https://').replace('&edge=curl', '') : null; };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function gDoc(v) {
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

async function googleList(q, { signal, max = 12 } = {}) {
  const r = await fetch(`${GB}?q=${encodeURIComponent(q)}&maxResults=${max}&printType=books&fields=${encodeURIComponent(GFIELDS)}`, { signal });
  if (!r.ok) throw new Error('google failed');
  return ((await r.json()).items || []).map(gDoc).filter(Boolean);
}

async function olSearch(q, { signal } = {}) {
  const r = await fetch(`${OL}/search.json?q=${encodeURIComponent(q)}&limit=12&fields=${FIELDS}`, { signal });
  if (!r.ok) throw new Error('search failed');
  return ((await r.json()).docs ?? []).filter(d => d.title).map(d => ({
    key: d.key, title: d.title, authors: d.author_name?.slice(0, 3) ?? [],
    first_publish_year: d.first_publish_year ?? null, cover_i: d.cover_i ?? null, cover_url: null,
    page_count: d.number_of_pages_median ?? null, isbn: d.isbn?.[0] ?? null,
  }));
}

export async function search(q, { signal } = {}) {
  q = q.trim();
  if (q.length < 2) return [];
  if (cache.has(q)) return cache.get(q);
  let docs = null, failed = null;
  try { docs = await olSearch(q, { signal }); } catch (e) { if (e.name === 'AbortError') throw e; failed = e; }
  if (!docs || docs.length < 4) {
    try {
      const g = await googleList(q, { signal });
      const have = new Set((docs || []).map(d => norm(d.title)));
      docs = [...(docs || []), ...g.filter(d => !have.has(norm(d.title)))].slice(0, 12);
    } catch (e) { if (e.name === 'AbortError') throw e; if (!docs) throw failed || e; }
  }
  cache.set(q, docs);
  return docs;
}

export async function byIsbn(raw) {
  const isbn = raw.replace(/[^0-9Xx]/g, '');
  if (isbn.length < 10) return null;
  try { const d = (await olSearch(`isbn:${isbn}`))[0]; if (d) return { ...d, isbn }; } catch { /* try google */ }
  try { const d = (await googleList(`isbn:${isbn}`, { max: 1 }))[0]; if (d) return { ...d, isbn }; } catch { /* nothing */ }
  return null;
}

/** A cover from Google Books for a book we have no image for. */
export async function googleCover(b) {
  const isbn = b.isbn13 || b.isbn;
  const author = (b.authors || [])[0];
  const q = isbn ? `isbn:${isbn}` : `intitle:"${b.title}"${author ? `+inauthor:"${author}"` : ''}`;
  const list = await googleList(q, { max: 4 });
  const want = norm(b.title);
  const hit = list.find(d => d.cover_url && (isbn || norm(d.title).startsWith(want.slice(0, 14)) || want.startsWith(norm(d.title).slice(0, 14))));
  return hit?.cover_url || null;
}

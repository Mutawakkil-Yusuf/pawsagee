// Public-domain reading: find a full-text edition on Internet Archive, clean it,
// and split it into comfortable, paginated pages for the in-app reader.
import type { BookDoc } from './types';

const IA_TEXT = (id: string) => `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(id)}_djvu.txt`;
const norm = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const CKEY = (b: BookDoc) => `pawsage.reader.${b.key || norm(b.title) + '-' + norm((b.authors || [])[0] || '')}`;

export interface Page { chapter: string; text: string; n: number }
export interface ReaderText { iaId: string; raw: string; title: string }

/** Clean OCR text: drop IA/Gutenberg boilerplate and collapse blank noise. */
export function cleanText(raw: string): string {
  let t = raw.replace(/\r\n?/g, '\n');
  const startMatch = t.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*/i);
  if (startMatch && startMatch.index !== undefined) t = t.slice(startMatch.index + startMatch[0].length);
  const end = t.search(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (end >= 0) t = t.slice(0, end);
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  // Skip Gutenberg's transcriber front matter: start at the first real chapter.
  const first = t.match(/^\s*(?:chapter|part|book|section)\s+(?:[ivxlcdm]+|\d+|[a-z]+)\b[^\n]*$/im);
  if (first && first.index !== undefined) t = t.slice(first.index);
  return t.trim();
}

/** Split into chapters when the text has recognizable headings, else one chapter. */
export function chapters(text: string): { title: string; text: string }[] {
  const lines = text.split('\n');
  const out: { title: string; lines: string[] }[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  const heading = /^\s*(?:chapter|part|book|section)\s+(?:[ivxlcdm]+|\d+|[a-z]+)\b[\s.:—-]*$/i;
  for (const line of lines) {
    const trimmed = line.trim();
    if (heading.test(trimmed) && trimmed.length < 60) {
      if (cur) out.push(cur);
      cur = { title: trimmed.replace(/[.\s—-]+$/, ''), lines: [] };
    } else if (cur) cur.lines.push(line);
    else if (!out.length) { cur = { title: 'the story', lines: [line] }; }
  }
  if (cur) out.push(cur);
  const mapped = out.map(c => ({
    title: c.title,
    text: c.lines.join('\n').replace(/\n(?!\n)/g, ' ').replace(/\n{2,}/g, '\n\n').trim(),
  })).filter(c => c.text.length > 5);
  // Fold any short preamble into the first real chapter.
  if (mapped.length > 1 && mapped[0].title === 'the story' && mapped[0].text.length < 300) {
    mapped[1].text = mapped[0].text + '\n\n' + mapped[1].text;
    mapped.shift();
  }
  return mapped.length ? mapped : [{ title: 'the story', text }];
}

/** Break text into pages, preferring sentence boundaries. */
export function paginate(text: string, size = 2400): string[] {
  const clean = text.replace(/\n{2,}/g, '\n\n').trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const pages: string[] = [];
  let rest = clean;
  while (rest.length > size) {
    const window = rest.slice(0, size);
    const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
    const at = cut > size * 0.6 ? cut + 1 : size;
    pages.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trimStart();
  }
  if (rest) pages.push(rest);
  return pages;
}

/** Turn a cleaned book into reader pages with chapter labels. */
export function toPages(text: string, size = 2400): Page[] {
  const pages: Page[] = [];
  for (const ch of chapters(text)) {
    for (const part of paginate(ch.text, size)) pages.push({ chapter: ch.title, text: part, n: pages.length + 1 });
  }
  return pages;
}

/** Remember the working IA id so next time we skip the probe. */
export function cachedIaId(b: BookDoc): string | null {
  try { return JSON.parse(localStorage.getItem(CKEY(b)) || 'null') as string | null; } catch { return null; }
}
function rememberIa(b: BookDoc, id: string) { try { localStorage.setItem(CKEY(b), JSON.stringify(id)); } catch { /* ignore */ } }

/** Find the first public-domain full text for a book, if one exists. */
/** Public-domain scans have recognizable IA identifiers; borrow-only ones don't. */
function scoreIa(id: string): number {
  if (/^(bwb_|isbn_|synapseml_)/i.test(id) || /librivox/i.test(id)) return -100;
  if (/gut$/i.test(id)) return 100;
  if (/^[a-z]+\d{2}[a-z]+$/i.test(id)) return 80; // e.g. prideprejudice01aust
  if (/0000/.test(id)) return -40;
  return id.length < 32 ? 10 : 0;
}

/** Prefer a clean Project Gutenberg text file over noisy OCR when an IA item has one. */
async function bestTextUrl(id: string): Promise<string> {
  try {
    const r = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`);
    if (r.ok) {
      const meta = await r.json() as { files?: { name: string; format?: string }[] };
      const files = (meta.files || []).map(f => f.name);
      const clean = files.find(n => /^\d+(-8)?\.txt$/i.test(n))
        || files.find(n => /^pg\d+\.txt(\.utf8)?$/i.test(n));
      if (clean) return `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(clean)}`;
    }
  } catch { /* fall through to OCR */ }
  return IA_TEXT(id);
}

export async function findReaderText(b: BookDoc): Promise<ReaderText | null> {
  let ids = [...(b.ia || [])];
  if (!ids.length) {
    // Look up archive ids on demand (Open Library search includes `ia`).
    try {
      const r = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(b.title)}&limit=3&fields=title,ia,author_name`);
      if (r.ok) {
        const docs = (await r.json()).docs as { ia?: string[] }[];
        ids = docs.flatMap(d => d.ia || []);
      }
    } catch { /* offline */ }
  }
  const cached = cachedIaId(b);
  if (cached) ids.unshift(cached);
  ids = [...new Set(ids)].sort((a, z) => scoreIa(z) - scoreIa(a)).slice(0, 16);

  for (const id of ids) {
    try {
      const r = await fetch(await bestTextUrl(id));
      if (!r.ok) continue;
      const type = r.headers.get('content-type') || '';
      if (!type.includes('text') && !type.includes('plain') && !type.includes('octet-stream')) continue;
      const raw = await r.text();
      if (raw.length < 5000 || raw.includes('<html')) continue;
      rememberIa(b, id);
      return { iaId: id, raw, title: b.title };
    } catch { /* try the next edition */ }
  }
  return null;
}
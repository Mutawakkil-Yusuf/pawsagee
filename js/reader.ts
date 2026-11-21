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

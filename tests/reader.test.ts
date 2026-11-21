import { describe, it, expect } from 'vitest';
import { cleanText, chapters, paginate, toPages } from '../js/reader';

describe('reader text cleanup', () => {
  it('strips Gutenberg boilerplate and collapses noise', () => {
    const raw = 'JUNK HEADER\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\nChapter I\n\nHello   world.\n\n\n\nAgain.\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***\nfooter';
    const out = cleanText(raw);
    expect(out.startsWith('Chapter I')).toBe(true);
    expect(out).not.toContain('JUNK HEADER');
    expect(out).not.toContain('END OF THE PROJECT');
    expect(out).not.toMatch(/\n{3,}/);
    expect(out).toContain('Hello world.');
  });

  it('leaves plain text untouched', () => {
    expect(cleanText('Once upon a time.')).toBe('Once upon a time.');
  });
});

describe('chapter splitting', () => {
  it('detects roman and numeric chapter headings', () => {
    const text = 'Intro line.\nCHAPTER I\nIt was the best of times.\nCHAPTER II\nIt was the worst of times.';
    const chs = chapters(text);
    expect(chs).toHaveLength(2);
    expect(chs[0].title).toBe('CHAPTER I');
    expect(chs[1].title).toBe('CHAPTER II');
    expect(chs[0].text).toContain('best of times');
  });

  it('falls back to a single chapter when there are no headings', () => {
    expect(chapters('just some text here')).toEqual([{ title: 'the story', text: 'just some text here' }]);
  });
});

describe('pagination', () => {
  it('returns one page for short text', () => {
    expect(paginate('short', 100)).toEqual(['short']);
  });

  it('splits long text into pages on sentence boundaries', () => {
    const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} ends here.`).join(' ');
    const pages = paginate(text, 300);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p.length).toBeLessThanOrEqual(320);
    expect(pages.join(' ')).toContain('Sentence number 59');
  });

  it('builds reader pages with chapter labels and numbering', () => {
    const text = 'CHAPTER I\n' + Array.from({ length: 40 }, (_, i) => `Word${i}. `).join('');
    const pages = toPages(text, 150);
    expect(pages.length).toBeGreaterThan(0);
    expect(pages[0].chapter).toBe('CHAPTER I');
    expect(pages[0].n).toBe(1);
    expect(pages[pages.length - 1].n).toBe(pages.length);
  });
});

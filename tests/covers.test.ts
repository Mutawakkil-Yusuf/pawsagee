import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BookDoc } from '../js/types';

beforeEach(() => { localStorage.clear(); vi.resetModules(); });

describe('cover resolution', () => {
  it('builds Open Library URLs and escapes ISBNs', async () => {
    const { olById, olByIsbn } = await import('../js/covers');
    expect(olById(123)).toBe('https://covers.openlibrary.org/b/id/123-M.jpg?default=false');
    expect(olByIsbn('978 0 306')).toContain('978%200%20306');
  });

  it('orders candidates: cover id, stored url, cached google, isbn', async () => {
    // covers.ts reads its cache at import time, so seed localStorage first
    localStorage.setItem('pawsage.covers.v1', JSON.stringify({ 'i9780307455925': { u: 'https://books.google.com/x.jpg', t: Date.now() } }));
    const { candidates, cachedGoogle, olByIsbn } = await import('../js/covers');
    const b: BookDoc = { title: 'A Book', authors: ['Someone'], cover_i: 42, cover_url: 'https://example.com/c.jpg', isbn: '9780307455925' };
    expect(cachedGoogle(b)).toBe('https://books.google.com/x.jpg');
    expect(candidates(b)).toEqual([
      'https://covers.openlibrary.org/b/id/42-M.jpg?default=false',
      'https://example.com/c.jpg',
      'https://books.google.com/x.jpg',
      olByIsbn('9780307455925'),
    ]);
  });

  it('falls back to an empty list for a book with no cover data', async () => {
    const { candidates } = await import('../js/covers');
    expect(candidates({ title: 'Unknown', authors: [] })).toEqual([]);
  });
});

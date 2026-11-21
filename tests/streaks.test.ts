import { describe, it, expect, beforeEach } from 'vitest';
import {
  dayKey, addDays, dayMap, currentStreak, longestStreak, daysSinceLastRead,
  weekStrip, monthGrid, monthStats, finishedInYear, celebrationKey, fmtMin, fmtClock,
} from '../js/streaks';
import type { ReadingSession, UserBook } from '../js/types';

const session = (day: string, pages = 10, sec = 600, id = 'b1'): ReadingSession => ({
  id: `s-${day}-${id}`, user_book_id: id, started_at: `${day}T12:00:00.000Z`,
  duration_sec: sec, start_page: 0, end_page: pages, pages_read: pages,
});

beforeEach(() => localStorage.clear());

describe('day helpers', () => {
  it('formats a local day key with zero padding', () => {
    expect(dayKey(new Date(2026, 0, 2))).toBe('2026-01-02');
    expect(dayKey('2026-11-21T23:30:00Z')).toMatch(/^2026-11-\d{2}$/);
  });
  it('adds and subtracts days across month/year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // leap year
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('dayMap', () => {
  it('aggregates pages, seconds and counts per local day', () => {
    const m = dayMap([session('2026-01-01', 10, 600), session('2026-01-01', 5, 300), session('2026-01-02', 7, 420)]);
    expect(m.get('2026-01-01')).toEqual({ sec: 900, pages: 15, n: 2 });
    expect(m.get('2026-01-02')).toEqual({ sec: 420, pages: 7, n: 1 });
  });
  it('accepts a custom day key function (timezone injection)', () => {
    const m = dayMap([session('2026-01-01T23:00:00Z')], s => s.started_at.slice(0, 10));
    expect(m.has('2026-01-01')).toBe(true);
  });
});

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    const m = dayMap([session('2026-01-01'), session('2026-01-02'), session('2026-01-03')]);
    expect(currentStreak(m, '2026-01-03')).toBe(3);
  });
  it('still counts through yesterday if today is not read yet', () => {
    const m = dayMap([session('2026-01-01'), session('2026-01-02')]);
    expect(currentStreak(m, '2026-01-03')).toBe(2);
  });
  it('returns 0 when the last read was two or more days ago', () => {
    const m = dayMap([session('2026-01-01')]);
    expect(currentStreak(m, '2026-01-03')).toBe(0);
  });
  it('returns 0 for no sessions', () => expect(currentStreak(new Map(), '2026-01-03')).toBe(0));
});

describe('longestStreak', () => {
  it('finds the longest run anywhere in the map', () => {
    const m = dayMap(['2026-01-01', '2026-01-02', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07'].map(d => session(d)));
    expect(longestStreak(m)).toBe(4);
  });
  it('respects the prefix filter', () => {
    const m = dayMap(['2025-12-31', '2026-01-01', '2026-01-02'].map(d => session(d)));
    expect(longestStreak(m, '2026-01')).toBe(2);
  });
  it('returns 0 for an empty map', () => expect(longestStreak(new Map())).toBe(0));
});

describe('daysSinceLastRead', () => {
  it('reports 0 today, positive gaps, or null when empty', () => {
    expect(daysSinceLastRead(dayMap([session('2026-01-03')]), '2026-01-03')).toBe(0);
    expect(daysSinceLastRead(dayMap([session('2026-01-01')]), '2026-01-04')).toBe(3);
    expect(daysSinceLastRead(new Map(), '2026-01-04')).toBeNull();
  });
});

describe('weekStrip and monthGrid', () => {
  it('marks read/today/future/missed states for a Monday-first week', () => {
    const m = dayMap([session('2026-01-05')]); // Monday
    const strip = weekStrip(m, new Date(2026, 0, 7)); // Wednesday
    expect(strip).toHaveLength(7);
    expect(strip[0].label).toBe('M');
    expect(strip[0].state).toBe('read');
    expect(strip[2].state).toBe('today');
    expect(strip[6].state).toBe('future');
    expect(strip[1].state).toBe('missed');
  });
  it('pads the month grid and flags read/today/future days', () => {
    const m = dayMap([session('2026-02-03')]);
    const cells = monthGrid(2026, 1, m); // February 2026 starts on Sunday => lead = 6
    expect(cells.slice(0, 6).every(c => c === null)).toBe(true);
    expect(cells.find(c => c?.d === 3)?.read).toBe(true);
  });
});

describe('monthStats and finishedInYear', () => {
  const book = (title: string, finished: string | null): UserBook => ({
    id: title, book_id: title, status: finished ? 'finished' : 'reading',
    rating: null, current_page: 0, started_at: null, finished_at: finished,
    is_favorite: false, notes: '', book: {
      id: title, ol_work_key: null, ol_cover_id: null, isbn13: null, cover_url: null,
      title, authors: [], first_publish_year: null, page_count: 100,
    }, shelf_ids: [],
  });
  it('totals pages, seconds, days and finished books for the month', () => {
    const sessions = [session('2026-01-01', 10, 600), session('2026-01-03', 20, 1200), session('2026-02-01', 99, 99)];
    const st = monthStats(2026, 0, { sessions, books: [book('a', '2026-01-02'), book('b', '2026-02-02')] });
    expect(st.pages).toBe(30);
    expect(st.seconds).toBe(1800);
    expect(st.days).toBe(2);
    expect(st.finished.map(b => b.book.title)).toEqual(['a']);
  });
  it('counts books finished in a year', () => {
    expect(finishedInYear([book('a', '2026-03-01'), book('b', '2025-03-01'), book('c', null)], 2026)).toBe(1);
  });
});

describe('celebration keys', () => {
  it('keys a streak milestone to the first day of that run', () => {
    expect(celebrationKey('streak', 7, '', '2026-01-07')).toBe('streak:7:2026-01-01');
    expect(celebrationKey('streak', 7, '', '2026-03-07')).toBe('streak:7:2026-03-01');
  });
  it('keys finished and goal celebrations by id / year', () => {
    expect(celebrationKey('finished', 0, 'ub-1')).toBe('finished:ub-1');
    expect(celebrationKey('goal', 12, '2026')).toBe('goal:2026');
  });
  it('marks and reads celebrated keys once', async () => {
    const { wasCelebrated, markCelebrated } = await import('../js/streaks');
    const key = 'test:once';
    expect(wasCelebrated(key)).toBe(false);
    markCelebrated(key);
    expect(wasCelebrated(key)).toBe(true);
  });
});

describe('formatters', () => {
  it('formats minutes and clocks', () => {
    expect(fmtMin(590)).toBe('10 min');
    expect(fmtMin(7200)).toBe('2 h');
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(65)).toBe('01:05');
    expect(fmtClock(3661)).toBe('1:01:01');
  });
});

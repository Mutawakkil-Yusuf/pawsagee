import { describe, it, expect, beforeEach } from 'vitest';
import { begin, elapsedSec, pause, resume, active, clear } from '../js/timer';

beforeEach(() => localStorage.clear());

describe('reading timer', () => {
  it('derives elapsed seconds from timestamps, not ticks', () => {
    const s = begin('book-1', 42);
    expect(elapsedSec(s, s.startedAt)).toBe(0);
    expect(elapsedSec(s, s.startedAt + 65_000)).toBe(65);
    expect(elapsedSec(s, s.startedAt - 10_000)).toBe(0); // never negative
  });

  it('excludes paused time', () => {
    const s = begin('book-1', 0);
    pause(s, s.startedAt + 10_000);
    expect(elapsedSec(s, s.startedAt + 40_000)).toBe(10);
    resume(s, s.startedAt + 40_000);
    expect(elapsedSec(s, s.startedAt + 70_000)).toBe(40);
  });

  it('pause and resume are idempotent', () => {
    const s = begin('book-1', 0);
    pause(s, 1000); pause(s, 2000);
    expect(s.pausedAt).toBe(1000);
    resume(s, 3000); resume(s, 4000);
    expect(s.pausedAt).toBeNull();
    expect(s.pausedMs).toBe(2000);
  });

  it('persists to localStorage and clears', () => {
    const s = begin('book-1', 7);
    expect(active()).toEqual(s);
    clear();
    expect(active()).toBeNull();
  });
});

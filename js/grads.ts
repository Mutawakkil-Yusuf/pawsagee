// Stable generated-cover gradients. Pure so it can be unit-tested without a DOM.
export interface Grad { a: string; b: string; dark?: number }
export const GRADS: Grad[] = [
  { a: '#8A78FF', b: '#5B4BC4', dark: 1 }, { a: '#FF8FB3', b: '#FFC6E0' }, { a: '#8FE0BF', b: '#C8F0E0' },
  { a: '#FFD36B', b: '#FFE8A3' }, { a: '#8CCDF5', b: '#B8E2F7' }, { a: '#4A3C9E', b: '#6C57E8', dark: 1 },
];

/** Deterministic 32-bit string hash (same algorithm used for cover gradients). */
export const hash = (s: unknown) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const gradFor = (title: unknown): Grad => GRADS[hash(String(title).toLowerCase()) % GRADS.length];

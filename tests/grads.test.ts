import { describe, it, expect } from 'vitest';
import { hash, gradFor, GRADS } from '../js/grads';

describe('generated cover gradients', () => {
  it('hashes deterministically', () => {
    expect(hash('dune')).toBe(hash('dune'));
    expect(hash('dune')).not.toBe(hash('Dune')); // case matters before lowercasing in gradFor
    expect(hash('')).toBe(0);
  });

  it('picks a gradient from the fixed palette', () => {
    for (const title of ['Dune', 'atomic habits', 'Americanah', 'Sapiens', '']) {
      expect(GRADS).toContain(gradFor(title));
    }
  });

  it('is stable and case-insensitive for a title', () => {
    expect(gradFor('Dune')).toBe(gradFor('dune'));
    expect(gradFor('Dune')).toBe(gradFor('Dune'));
  });
});

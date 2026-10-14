import { describe, it, expect } from 'vitest';
import { shuffle, pick } from '../../src/curriculum/random.js';
import { seededRng } from '../helpers.js';

describe('random', () => {
  it('shuffle returns a permutation without mutating', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seededRng(7));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(input);
  });

  it('pick returns an element and throws on empty', () => {
    expect(['a', 'b']).toContain(pick(['a', 'b'], seededRng(1)));
    expect(() => pick([], seededRng(1))).toThrow(/non-empty/);
  });
});

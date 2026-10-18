import { describe, it, expect } from 'vitest';
import { LETTER_ORDER } from '../../src/curriculum/units.js';
import { STROKES, strokesFor, LETTER_BOX } from '../../src/intro/strokes.js';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const points = (strokes) => strokes.flat();

describe('letter strokes', () => {
  it('has strokes for every letter of the alphabet', () => {
    expect(Object.keys(STROKES).sort()).toEqual(ALPHABET);
  });

  it.each(ALPHABET)('"%s" strokes are lists of points inside the letter box', (letter) => {
    expect(STROKES[letter].length).toBeGreaterThan(0);
    points(STROKES[letter]).forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(LETTER_BOX.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(LETTER_BOX.height);
    });
  });

  it('keeps short letters between the x-height and the baseline', () => {
    ['a', 'c', 'e', 'm', 'n', 'o', 'r', 's', 'u', 'v', 'w', 'x', 'z'].forEach((letter) => {
      points(STROKES[letter]).forEach(([, y]) => {
        expect(y).toBeGreaterThanOrEqual(LETTER_BOX.xHeight - 2);
        expect(y).toBeLessThanOrEqual(LETTER_BOX.baseline + 2);
      });
    });
  });

  it('gives tall letters ascenders and tail letters descenders', () => {
    const top = (l) => Math.min(...points(STROKES[l]).map(([, y]) => y));
    const bottom = (l) => Math.max(...points(STROKES[l]).map(([, y]) => y));
    ['b', 'd', 'h', 'k', 'l'].forEach((l) => expect(top(l)).toBeLessThan(LETTER_BOX.xHeight - 20));
    ['g', 'j', 'p', 'q', 'y'].forEach((l) => expect(bottom(l)).toBeGreaterThan(LETTER_BOX.baseline + 20));
  });

  it('lays multi-letter sounds out side by side, one letter after another', () => {
    const sh = strokesFor('sh');
    expect(sh.width).toBe(2 * LETTER_BOX.width + LETTER_BOX.gap);
    expect(sh.strokes).toHaveLength(STROKES.s.length + STROKES.h.length);
    const hStart = sh.strokes[STROKES.s.length][0];
    expect(hStart[0]).toBe(STROKES.h[0][0][0] + LETTER_BOX.width + LETTER_BOX.gap);
  });

  it('can lay out every sound the app teaches', () => {
    LETTER_ORDER.forEach((sound) => expect(strokesFor(sound).strokes.length).toBeGreaterThan(0));
  });
});

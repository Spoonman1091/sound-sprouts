import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import { LETTER_ORDER, BLEND_WORDS, isLongWord } from '../../src/curriculum/units.js';
import { readyBlends } from '../../src/curriculum/blends.js';
import { withMastered } from '../helpers.js';

const shortWords = BLEND_WORDS.filter((w) => !isLongWord(w));
const longWords = BLEND_WORDS.filter(isLongWord);
const masterBlends = (words, p) => withMastered(p, words.map((w) => `blend:${w}`));

describe('readyBlends', () => {
  it('offers short words as soon as their sounds are mastered', () => {
    expect(readyBlends(withMastered(), ['s', 'i', 'p'])).toEqual(['sip']);
  });

  it('holds longer words back until enough short words are mastered', () => {
    const before = masterBlends(shortWords.slice(0, CONFIG.LONG_WORD_MIN_BLENDS - 1));
    expect(readyBlends(before, LETTER_ORDER)).not.toContain('stop');
    const after = masterBlends(shortWords.slice(0, CONFIG.LONG_WORD_MIN_BLENDS));
    expect(readyBlends(after, LETTER_ORDER)).toEqual(expect.arrayContaining(longWords));
  });

  it('still needs every sound in a longer word mastered', () => {
    const p = masterBlends(shortWords.slice(0, CONFIG.LONG_WORD_MIN_BLENDS));
    expect(readyBlends(p, LETTER_ORDER.filter((l) => l !== 'r'))).not.toContain('frog');
  });
});

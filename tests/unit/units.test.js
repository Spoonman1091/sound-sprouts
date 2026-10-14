import { describe, it, expect } from 'vitest';
import { LETTER_ORDER, FIRST_SOUND_WORDS, RHYME_SETS, BLEND_WORDS, PICTURE_WORDS } from '../../src/curriculum/units.js';

describe('curriculum data', () => {
  it('first-sound words start with their letter', () => {
    Object.entries(FIRST_SOUND_WORDS).forEach(([letter, words]) => {
      expect(LETTER_ORDER).toContain(letter);
      words.forEach((w) => expect(w[0]).toBe(letter));
    });
  });

  it('blend words only use taught letters', () => {
    BLEND_WORDS.forEach((w) => [...w].forEach((ch) => expect(LETTER_ORDER).toContain(ch)));
  });

  it('every rhyme set has a target plus at least one rhyme, and no word is in two sets', () => {
    RHYME_SETS.forEach((set) => expect(set.length).toBeGreaterThanOrEqual(2));
    const all = RHYME_SETS.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('PICTURE_WORDS is the unique union of all pictured words', () => {
    const expected = new Set([...Object.values(FIRST_SOUND_WORDS).flat(), ...RHYME_SETS.flat(), ...BLEND_WORDS]);
    expect(new Set(PICTURE_WORDS)).toEqual(expected);
    expect(PICTURE_WORDS.length).toBe(expected.size);
  });
});

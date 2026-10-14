import { describe, it, expect } from 'vitest';
import { LETTER_ORDER, FIRST_SOUND_WORDS, RHYME_SETS, BLEND_WORDS, PICTURE_WORDS, soundsAlike } from '../../src/curriculum/units.js';

describe('curriculum data', () => {
  it('teaches s a t p, i n m d, g o c k, e u h r, f b, l j v w in order', () => {
    expect(LETTER_ORDER).toEqual(['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k', 'e', 'u', 'h', 'r', 'f', 'b', 'l', 'j', 'v', 'w']);
    ['l', 'j', 'v', 'w'].forEach((l) => expect(FIRST_SOUND_WORDS[l]).toHaveLength(2));
    expect(BLEND_WORDS).toEqual(expect.arrayContaining(['log', 'leg', 'web']));
    ['h', 'r', 'f', 'b'].forEach((l) => expect(FIRST_SOUND_WORDS[l]).toHaveLength(2));
    expect(BLEND_WORDS).toEqual(expect.arrayContaining(['hat', 'bag', 'bed', 'bus', 'bug']));
    expect(BLEND_WORDS).not.toContain('rat');
    ['c', 'k', 'e'].forEach((l) => expect(FIRST_SOUND_WORDS[l]).toHaveLength(2));
    expect(FIRST_SOUND_WORDS.u).toEqual(['umbrella']);
    expect(BLEND_WORDS).toEqual(expect.arrayContaining(['cat', 'cap', 'pen', 'ten', 'sun', 'nut', 'cup']));
    ['m', 'd', 'g', 'o'].forEach((l) => expect(FIRST_SOUND_WORDS[l]).toHaveLength(2));
    expect(BLEND_WORDS).toEqual(expect.arrayContaining(['dog', 'pig', 'map', 'sad', 'man']));
  });

  it('first-sound words start with their letter', () => {
    Object.entries(FIRST_SOUND_WORDS).forEach(([letter, words]) => {
      expect(LETTER_ORDER).toContain(letter);
      words.forEach((w) => expect(w[0]).toBe(letter));
    });
  });

  it('treats c and k as the same sound, and nothing else', () => {
    expect(soundsAlike('c', 'k')).toBe(true);
    expect(soundsAlike('k', 'c')).toBe(true);
    expect(soundsAlike('c', 'c')).toBe(true);
    expect(soundsAlike('c', 'g')).toBe(false);
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

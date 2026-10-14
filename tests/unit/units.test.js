import { describe, it, expect } from 'vitest';
import { LETTER_ORDER, FIRST_SOUND_WORDS, RHYME_SETS, BLEND_WORDS, PICTURE_WORDS, soundsAlike, graphemes } from '../../src/curriculum/units.js';

describe('curriculum data', () => {
  it('teaches s a t p, i n m d, g o c k, e u h r, f b, l j v w, x y z q in order', () => {
    expect(LETTER_ORDER).toEqual(['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k', 'e', 'u', 'h', 'r', 'f', 'b', 'l', 'j', 'v', 'w', 'x', 'y', 'z', 'q',
      'sh', 'ch', 'th', 'ng', 'ck']);
    expect(LETTER_ORDER.filter((l) => l.length === 1).sort().join('')).toBe('abcdefghijklmnopqrstuvwxyz');
    ['y', 'z'].forEach((l) => expect(FIRST_SOUND_WORDS[l]).toHaveLength(2));
    expect(FIRST_SOUND_WORDS.q).toEqual(['queen']);
    expect(FIRST_SOUND_WORDS.x).toBeUndefined();
    expect(BLEND_WORDS).toEqual(expect.arrayContaining(['fox', 'box', 'six']));
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
      words.forEach((w) => expect(graphemes(w)[0]).toBe(letter));
    });
  });

  it('treats c, k and q ("kw") as sounding alike, and nothing else', () => {
    expect(soundsAlike('c', 'k')).toBe(true);
    expect(soundsAlike('k', 'c')).toBe(true);
    ['c', 'k'].forEach((l) => {
      expect(soundsAlike('q', l)).toBe(true);
      expect(soundsAlike(l, 'q')).toBe(true);
    });
    expect(soundsAlike('q', 'w')).toBe(false);
    expect(soundsAlike('c', 'c')).toBe(true);
    expect(soundsAlike('c', 'g')).toBe(false);
  });

  it('blend words only use taught sounds', () => {
    BLEND_WORDS.forEach((w) => graphemes(w).forEach((g) => expect(LETTER_ORDER).toContain(g)));
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

  it('ends with the digraphs sh ch th ng ck', () => {
    expect(LETTER_ORDER.slice(-5)).toEqual(['sh', 'ch', 'th', 'ng', 'ck']);
    ['sh', 'ch', 'th'].forEach((d) => expect(FIRST_SOUND_WORDS[d]).toHaveLength(2));
    expect(FIRST_SOUND_WORDS.ng).toBeUndefined();
    expect(FIRST_SOUND_WORDS.ck).toBeUndefined();
    expect(BLEND_WORDS).toEqual(expect.arrayContaining(['fish', 'ship', 'chick', 'duck', 'sock', 'rock', 'bath', 'ring']));
  });

  it('splits words into sounds, keeping digraphs together', () => {
    expect(graphemes('cat')).toEqual(['c', 'a', 't']);
    expect(graphemes('fish')).toEqual(['f', 'i', 'sh']);
    expect(graphemes('chick')).toEqual(['ch', 'i', 'ck']);
    expect(graphemes('ring')).toEqual(['r', 'i', 'ng']);
    expect(graphemes('bath')).toEqual(['b', 'a', 'th']);
  });

  it('groups ck with c, k and q, but keeps s and sh apart', () => {
    ['c', 'k', 'q'].forEach((l) => expect(soundsAlike('ck', l)).toBe(true));
    expect(soundsAlike('sh', 's')).toBe(false);
    expect(soundsAlike('ch', 'c')).toBe(false);
  });
});

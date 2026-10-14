import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { PROMPT_IDS, prompt, phoneme, letterName, word, imgPath } from '../../src/audio/clips.js';
import { LETTER_ORDER, PICTURE_WORDS, SIGHT_WORDS } from '../../src/curriculum/units.js';
import { PROMPT_TEXT, LETTER_NAME_TEXT } from '../../tools/audio-script.mjs';
import { IMAGE_CODEPOINTS, GARDEN_IMAGES } from '../../tools/image-map.mjs';

const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz'];
const missing = (paths) => paths.filter((p) => !existsSync(p));

describe('content assets', () => {
  it('has text for exactly the prompts the code uses', () => {
    expect(Object.keys(PROMPT_TEXT).sort()).toEqual([...PROMPT_IDS].sort());
    expect(Object.keys(LETTER_NAME_TEXT).sort()).toEqual(ALPHABET);
  });

  it('has an image mapping for every picture and garden image', () => {
    [...PICTURE_WORDS, ...GARDEN_IMAGES].forEach((w) => expect(IMAGE_CODEPOINTS[w]).toMatch(/^[0-9A-F-]+$/));
  });

  it('has every audio clip on disk', () => {
    expect(missing([
      ...PROMPT_IDS.map(prompt),
      ...LETTER_ORDER.map(phoneme),
      ...ALPHABET.map(letterName),
      ...PICTURE_WORDS.map(word),
      ...Object.keys(SIGHT_WORDS).map(word),
    ])).toEqual([]);
  });

  it('has every image and font on disk', () => {
    expect(missing([
      ...[...PICTURE_WORDS, ...GARDEN_IMAGES].map(imgPath),
      'assets/fonts/andika-400.woff2',
      'assets/fonts/andika-700.woff2',
    ])).toEqual([]);
  });

  it('credits every third-party source', () => {
    const credits = readFileSync('credits.html', 'utf8');
    ['OpenMoji', 'CC BY-SA 4.0', 'Andika', 'SIL Open Font License'].forEach((s) => expect(credits).toContain(s));
  });

  it('credits generated speech only while some clips are still generated', () => {
    const credits = readFileSync('credits.html', 'utf8');
    const recorded = JSON.parse(readFileSync('tools/recorder/recorded.json', 'utf8'));
    const total = new Set(LETTER_ORDER.map(phoneme)).size + PROMPT_IDS.length + PICTURE_WORDS.length + Object.keys(SIGHT_WORDS).length + ALPHABET.length;
    expect(credits.includes('Piper')).toBe(recorded.length < total);
  });
});

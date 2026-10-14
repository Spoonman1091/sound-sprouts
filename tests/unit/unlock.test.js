import { describe, it, expect } from 'vitest';
import { createProgress, recordAttempt } from '../../src/state/progress.js';
import { unlockedLetters, letterStatus, markLetterMastered } from '../../src/curriculum/unlock.js';
import { isMastered } from '../../src/state/progress.js';
import { withMastered } from '../helpers.js';

describe('unlockedLetters', () => {
  it('opens the first two letters at the start', () => {
    expect(unlockedLetters(createProgress())).toEqual(['s', 'a']);
  });

  it('opens the next letter once the previous ones are mastered', () => {
    expect(unlockedLetters(withMastered(undefined, ['ls:s', 'ls:a']))).toEqual(['s', 'a', 't']);
  });

  it('opens everything when all are mastered', () => {
    const all = ['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k', 'e', 'u', 'h', 'r', 'f', 'b', 'l', 'j', 'v', 'w', 'x', 'y', 'z', 'q', 'sh', 'ch', 'th', 'ng', 'ck', 'ee', 'oo', 'ai', 'oa', 'ar', 'or'];
    expect(unlockedLetters(withMastered(undefined, all.map((l) => `ls:${l}`)))).toEqual(all);
  });
});

describe('letterStatus', () => {
  it('maps to seed, sprout, flower and thirsty', () => {
    const mastered = withMastered(undefined, ['ls:s']);
    expect(letterStatus(createProgress(), 'n')).toBe('seed');
    expect(letterStatus(createProgress(), 's')).toBe('sprout');
    expect(letterStatus(mastered, 's')).toBe('flower');
    const missed = [4, 5].reduce((p, at) => recordAttempt(p, { itemId: 'ls:s', firstTry: false, sessionId: 'x', at }), mastered);
    expect(letterStatus(missed, 's')).toBe('thirsty');
  });
});

describe('markLetterMastered', () => {
  it('masters the letter sound and its first-sound pictures, and opens the next letter', () => {
    const p = markLetterMastered(markLetterMastered(createProgress(), 's', 1), 'a', 2);
    ['ls:s', 'fs:s', 'ls:a', 'fs:a'].forEach((id) => expect(isMastered(p, id)).toBe(true));
    expect(letterStatus(p, 's')).toBe('flower');
    expect(unlockedLetters(p)).toEqual(['s', 'a', 't']);
  });

  it('only marks the letter sound when the letter has no first-sound pictures', () => {
    const p = markLetterMastered(createProgress(), 'i', 1);
    expect(Object.keys(p.items)).toEqual(['ls:i']);
  });
});

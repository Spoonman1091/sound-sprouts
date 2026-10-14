import { describe, it, expect } from 'vitest';
import { createProgress, recordAttempt } from '../../src/state/progress.js';
import { unlockedLetters, letterStatus } from '../../src/curriculum/unlock.js';
import { withMastered } from '../helpers.js';

describe('unlockedLetters', () => {
  it('opens the first two letters at the start', () => {
    expect(unlockedLetters(createProgress())).toEqual(['s', 'a']);
  });

  it('opens the next letter once the previous ones are mastered', () => {
    expect(unlockedLetters(withMastered(undefined, ['ls:s', 'ls:a']))).toEqual(['s', 'a', 't']);
  });

  it('opens everything when all are mastered', () => {
    const all = ['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k', 'e', 'u'];
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

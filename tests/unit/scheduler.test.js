import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import { createProgress, setChildName, recordAttempt } from '../../src/state/progress.js';
import { availableItems, sortForReview, interleave, dedupeAdjacent, planSession, introsDue, planLesson } from '../../src/curriculum/scheduler.js';
import { markIntroduced, markMastered } from '../../src/state/progress.js';
import { LETTER_ORDER, FIRST_SOUND_WORDS } from '../../src/curriculum/units.js';
import { seededRng, withMastered } from '../helpers.js';

const allLetterSounds = LETTER_ORDER.map((l) => `ls:${l}`);
const allFirstSounds = Object.keys(FIRST_SOUND_WORDS).map((l) => `fs:${l}`);

describe('helpers', () => {
  it('interleave alternates and keeps leftovers', () => {
    expect(interleave([1, 2, 3], ['a'])).toEqual([1, 'a', 2, 3]);
  });

  it('dedupeAdjacent removes back-to-back repeats only', () => {
    expect(dedupeAdjacent(['a', 'a', 'b', 'a'])).toEqual(['a', 'b', 'a']);
  });

  it('sortForReview puts struggling items first, then least recently seen', () => {
    let p = withMastered(undefined, ['ls:s', 'ls:a', 'fs:s']);
    p = recordAttempt(p, { itemId: 'fs:s', firstTry: true, sessionId: 'z', at: 50 });
    p = [60, 61].reduce((acc, at) => recordAttempt(acc, { itemId: 'ls:a', firstTry: false, sessionId: 'z', at }), p);
    expect(sortForReview(p, ['fs:s', 'ls:s', 'ls:a'])).toEqual(['ls:a', 'ls:s', 'fs:s']);
  });
});

describe('availableItems', () => {
  it('starts with rhymes and the first two letters only', () => {
    const items = availableItems(createProgress());
    expect(items).toEqual(expect.arrayContaining(['rhyme:0', 'ls:s', 'fs:s', 'ls:a', 'fs:a']));
    expect(items.some((id) => id.startsWith('blend:'))).toBe(false);
    expect(items).not.toContain('ls:t');
    expect(items).not.toContain('name');
  });

  it('adds name when a spellable name is set', () => {
    expect(availableItems(setChildName(createProgress(), 'Ava'))).toContain('name');
  });

  it('adds blends only when every letter in the word is mastered', () => {
    const p = withMastered(undefined, ['ls:s', 'ls:a', 'ls:t', 'ls:p', 'ls:i', 'ls:n']);
    expect(availableItems(p)).toEqual(expect.arrayContaining(['blend:pin', 'blend:sip', 'blend:tap']));
    expect(availableItems(withMastered(undefined, ['ls:s', 'ls:a']))).not.toContain('blend:tap');
  });

  it('holds longer words back while only the letters are mastered', () => {
    expect(availableItems(withMastered(undefined, allLetterSounds))).not.toContain('blend:stop');
  });

  it('needs the digraph itself mastered, not just its letters', () => {
    const singles = LETTER_ORDER.filter((l) => l.length === 1).map((l) => `ls:${l}`);
    expect(availableItems(withMastered(undefined, singles))).not.toContain('blend:fish');
    expect(availableItems(withMastered(undefined, [...singles, 'ls:sh']))).toContain('blend:fish');
  });

  it('adds sight words once the first letters are mastered', () => {
    const first = LETTER_ORDER.slice(0, CONFIG.SIGHT_WORDS_AFTER_LETTERS).map((l) => `ls:${l}`);
    expect(availableItems(withMastered(undefined, first.slice(0, -1)))).not.toContain('sight:the');
    expect(availableItems(withMastered(undefined, first))).toEqual(expect.arrayContaining(['sight:the', 'sight:i', 'sight:a', 'sight:is']));
  });

  it('has no fs:i item', () => {
    expect(availableItems(withMastered(undefined, allLetterSounds))).not.toContain('fs:i');
  });
});

describe('planSession', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('fresh session (seed %i) is well-formed', (seed) => {
    const plan = planSession(createProgress(), seededRng(seed));
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThanOrEqual(CONFIG.SESSION_LENGTH);
    expect(plan[0]).toMatch(/^rhyme:/);
    const letterItems = ['ls:s', 'fs:s', 'ls:a', 'fs:a'].filter((id) => plan.includes(id));
    expect(letterItems).toHaveLength(CONFIG.FOCUS_ITEMS);
    plan.forEach((id, i) => expect(id).not.toBe(plan[i - 1]));
  });

  it.each([1, 2, 3, 4, 5])('fresh session (seed %i) caps rhymes and repeats focus items', (seed) => {
    const plan = planSession(createProgress(), seededRng(seed));
    const rhymes = plan.filter((id) => id.startsWith('rhyme:'));
    expect(rhymes.length).toBeLessThanOrEqual(1 + CONFIG.MAX_RHYMES_PER_SESSION);
    expect(plan).toHaveLength(CONFIG.SESSION_LENGTH);
    expect(new Set(plan.filter((id) => !id.startsWith('rhyme:'))).size).toBeLessThan(plan.length - rhymes.length);
  });

  it.each([1, 2, 3, 4, 5])('fresh session (seed %i) shows every focus item twice', (seed) => {
    const plan = planSession(createProgress(), seededRng(seed));
    const focus = [...new Set(plan.filter((id) => /^(ls|fs):/.test(id)))];
    expect(focus).toHaveLength(CONFIG.FOCUS_ITEMS);
    focus.forEach((id) => expect(plan.filter((x) => x === id)).toHaveLength(2));
  });

  it('repeats a lone focus item instead of dropping it as a duplicate', () => {
    const p = withMastered(undefined, ['ls:s', 'fs:s', 'fs:a', ...Array.from({ length: 9 }, (_, i) => `rhyme:${i}`)]);
    const plan = planSession(p, seededRng(2));
    expect(plan.filter((id) => id === 'ls:a')).toHaveLength(2);
  });

  it('review only brings back mastered items, never extra unmastered rhymes', () => {
    const p = withMastered(undefined, ['ls:s', 'fs:s', 'rhyme:0']);
    const plan = planSession(p, seededRng(6));
    const unmasteredRhymes = plan.filter((id) => id.startsWith('rhyme:') && id !== 'rhyme:0');
    expect(unmasteredRhymes.length).toBeLessThanOrEqual(CONFIG.MAX_RHYMES_PER_SESSION + 1);
  });

  it('warms up with the name when it is not mastered yet', () => {
    expect(planSession(setChildName(createProgress(), 'Ava'), seededRng(1))[0]).toBe('name');
  });

  it('focuses on the newly unlocked letter', () => {
    const plan = planSession(withMastered(undefined, ['ls:s', 'fs:s', 'ls:a', 'fs:a']), seededRng(2));
    expect(plan).toEqual(expect.arrayContaining(['ls:t', 'fs:t']));
  });

  it('includes blends once letters and first sounds are mastered', () => {
    const plan = planSession(withMastered(undefined, [...allLetterSounds, ...allFirstSounds]), seededRng(3));
    expect(plan.some((id) => id.startsWith('blend:'))).toBe(true);
  });

  it('still produces a full session when everything is mastered', () => {
    const everything = availableItems(withMastered(undefined, allLetterSounds));
    const plan = planSession(withMastered(undefined, everything), seededRng(4));
    expect(plan).toHaveLength(CONFIG.SESSION_LENGTH);
  });
});

describe('introductions', () => {
  it('introduces each open sound she has not met yet', () => {
    expect(introsDue(createProgress())).toEqual(['s', 'a']);
    expect(introsDue(markIntroduced(createProgress(), 's'))).toEqual(['a']);
  });

  it('skips sounds that are already mastered, e.g. marked by a parent', () => {
    const p = ['s', 'a'].reduce((acc, l) => markMastered(acc, `ls:${l}`, 1), createProgress());
    expect(introsDue(p)).toEqual(['t']);
  });

  it('starts a lesson with its introductions, then the usual practice', () => {
    const fresh = createProgress();
    const lesson = planLesson(fresh, seededRng(3));
    expect(lesson.slice(0, 2)).toEqual(['intro:s', 'intro:a']);
    expect(lesson.slice(2)).toEqual(planSession(fresh, seededRng(3)));
    const met = ['s', 'a'].reduce(markIntroduced, fresh);
    expect(planLesson(met, seededRng(3)).some((id) => id.startsWith('intro:'))).toBe(false);
  });
});

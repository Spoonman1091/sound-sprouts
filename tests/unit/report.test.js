import { describe, it, expect } from 'vitest';
import { createProgress, recordAttempt, recordSession } from '../../src/state/progress.js';
import { firstTryRate, describeItem, practiceList, sessionsInLastDays, rhymesMastered } from '../../src/parent/report.js';
import { CONFIG } from '../../src/config.js';
import { withMastered } from '../helpers.js';

describe('report', () => {
  it('firstTryRate is a whole percentage or null', () => {
    const p = [true, false, true].reduce((acc, firstTry, at) => recordAttempt(acc, { itemId: 'ls:s', firstTry, sessionId: 's', at }), createProgress());
    expect(firstTryRate(p, 'ls:s')).toBe(67);
    expect(firstTryRate(p, 'ls:a')).toBeNull();
  });

  it.each([
    ['ls:s', 'Letter sound “s”'],
    ['fs:a', 'First sound “a”'],
    ['blend:pin', 'Blending “pin”'],
    ['rhyme:0', 'Rhyming: cat, hat, bat'],
    ['name', 'Spelling their name'],
    ['weird', 'weird'],
  ])('describeItem(%s)', (id, label) => {
    expect(describeItem(id)).toBe(label);
  });

  it('practiceList lists struggling items', () => {
    const p = [1, 2].reduce((acc, at) => recordAttempt(acc, { itemId: 'fs:s', firstTry: false, sessionId: 's', at }), createProgress());
    expect(practiceList(p)).toEqual(['First sound “s”']);
  });

  it('counts sessions within the window and mastered rhymes', () => {
    const now = 10 * CONFIG.DAY_MS;
    const p = [now - 8 * CONFIG.DAY_MS, now - CONFIG.DAY_MS, now].reduce(
      (acc, at, i) => recordSession(acc, { sessionId: `s${i}`, at, itemCount: 8 }), createProgress());
    expect(sessionsInLastDays(p, 7, now)).toBe(2);
    expect(rhymesMastered(withMastered(undefined, ['rhyme:0', 'rhyme:3']))).toBe(2);
  });
});

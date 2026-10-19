import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import {
  createProgress, recordAttempt, recordSession, isMastered, isStruggling, lastSeen, setChildName, markMastered, unmarkMastered, markIntroduced, hasMet,
} from '../../src/state/progress.js';

const attempt = (p, itemId, firstTry, sessionId, at) => recordAttempt(p, { itemId, firstTry, sessionId, at });

describe('recordAttempt', () => {
  it('appends without mutating the original', () => {
    const before = createProgress();
    const after = attempt(before, 'ls:s', true, 's1', 10);
    expect(before.items).toEqual({});
    expect(after.items['ls:s'].attempts).toEqual([{ firstTry: true, sessionId: 's1', at: 10 }]);
  });

  it('keeps only the last ATTEMPT_HISTORY attempts', () => {
    const p = Array.from({ length: CONFIG.ATTEMPT_HISTORY + 3 }, (_, i) => i)
      .reduce((acc, i) => attempt(acc, 'ls:s', false, 's1', i), createProgress());
    expect(p.items['ls:s'].attempts).toHaveLength(CONFIG.ATTEMPT_HISTORY);
    expect(p.items['ls:s'].attempts[0].at).toBe(3);
  });
});

describe('mastery', () => {
  it('needs 4 first-try successes in a row, over at least 3 lessons', () => {
    expect(CONFIG.MASTERY_STREAK).toBe(4);
    expect(CONFIG.MASTERY_MIN_SESSIONS).toBe(3);
    let p = [['s1', 1], ['s1', 2], ['s2', 3]].reduce((acc, [s, at]) => attempt(acc, 'ls:s', true, s, at), createProgress());
    p = attempt(p, 'ls:s', true, 's2', 4);
    expect(isMastered(p, 'ls:s')).toBe(false);
    p = attempt(p, 'ls:s', true, 's3', 5);
    expect(isMastered(p, 'ls:s')).toBe(true);
    expect(p.items['ls:s'].masteredAt).toBe(5);
  });

  it('a wrong tap restarts the streak', () => {
    const tries = [[true, 's1'], [true, 's1'], [false, 's2'], [true, 's2'], [true, 's3'], [true, 's3']];
    let p = tries.reduce((acc, [ok, s], at) => attempt(acc, 'ls:s', ok, s, at), createProgress());
    expect(isMastered(p, 'ls:s')).toBe(false);
    p = attempt(p, 'ls:s', true, 's4', 9);
    expect(isMastered(p, 'ls:s')).toBe(true);
  });

  it('does not master when all successes are in one session', () => {
    const p = [1, 2, 3, 4, 5].reduce((acc, at) => attempt(acc, 'ls:s', true, 's1', at), createProgress());
    expect(isMastered(p, 'ls:s')).toBe(false);
  });

  it('does not master when a miss is inside the streak', () => {
    let p = attempt(createProgress(), 'ls:s', true, 's1', 1);
    p = attempt(p, 'ls:s', false, 's2', 2);
    p = attempt(p, 'ls:s', true, 's2', 3);
    expect(isMastered(p, 'ls:s')).toBe(false);
  });

  it('stays mastered after a later miss', () => {
    let p = [['s1', 1], ['s2', 2], ['s3', 3], ['s3', 4]].reduce((acc, [s, at]) => attempt(acc, 'ls:s', true, s, at), createProgress());
    p = attempt(p, 'ls:s', false, 's4', 5);
    expect(isMastered(p, 'ls:s')).toBe(true);
  });

  it('is false for unknown items', () => {
    expect(isMastered(createProgress(), 'nope')).toBe(false);
  });
});

describe('isStruggling', () => {
  it('is true with STRUGGLE_MISSES misses in the last STRUGGLE_WINDOW', () => {
    let p = attempt(createProgress(), 'fs:a', false, 's1', 1);
    expect(isStruggling(p, 'fs:a')).toBe(false);
    p = attempt(p, 'fs:a', false, 's1', 2);
    expect(isStruggling(p, 'fs:a')).toBe(true);
  });

  it('is false for unknown items', () => {
    expect(isStruggling(createProgress(), 'nope')).toBe(false);
  });
});

describe('lastSeen, recordSession, setChildName', () => {
  it('lastSeen returns the latest attempt time or 0', () => {
    const p = attempt(attempt(createProgress(), 'x', true, 's1', 5), 'x', true, 's1', 9);
    expect(lastSeen(p, 'x')).toBe(9);
    expect(lastSeen(p, 'y')).toBe(0);
  });

  it('recordSession keeps the last SESSION_HISTORY sessions immutably', () => {
    const before = createProgress();
    const p = Array.from({ length: CONFIG.SESSION_HISTORY + 1 }, (_, i) => i)
      .reduce((acc, i) => recordSession(acc, { sessionId: `s${i}`, at: i, itemCount: 8 }), before);
    expect(before.sessions).toEqual([]);
    expect(p.sessions).toHaveLength(CONFIG.SESSION_HISTORY);
    expect(p.sessions[0].sessionId).toBe('s1');
  });

  it('setChildName returns a new progress', () => {
    const before = createProgress();
    expect(setChildName(before, 'Ava').childName).toBe('Ava');
    expect(before.childName).toBe('');
  });
});

describe('markMastered', () => {
  it('masters an item without touching its attempts or the original', () => {
    const before = attempt(createProgress(), 'ls:s', false, 'a', 1);
    const after = markMastered(before, 'ls:s', 50);
    expect(isMastered(after, 'ls:s')).toBe(true);
    expect(after.items['ls:s'].attempts).toEqual(before.items['ls:s'].attempts);
    expect(isMastered(before, 'ls:s')).toBe(false);
  });

  it('works for an item never tried, and keeps an earlier mastery date', () => {
    expect(markMastered(createProgress(), 'ls:a', 7).items['ls:a']).toEqual({ attempts: [], masteredAt: 7, parentMarked: true });
    const mastered = markMastered(createProgress(), 'ls:a', 7);
    expect(markMastered(mastered, 'ls:a', 99).items['ls:a'].masteredAt).toBe(7);
  });
});

describe('unmarkMastered', () => {
  it('takes away the mastery and the tries that earned it, so she has to earn it again', () => {
    const earned = [1, 2, 3, 4].reduce((p, n) => attempt(p, 'ls:s', true, `s${n}`, n), createProgress());
    expect(isMastered(earned, 'ls:s')).toBe(true);
    const after = unmarkMastered(earned, 'ls:s');
    expect(after.items['ls:s']).toEqual({ attempts: [], masteredAt: null });
    expect(isMastered(earned, 'ls:s')).toBe(true);
    expect(isMastered(attempt(after, 'ls:s', true, 's5', 5), 'ls:s')).toBe(false);
  });

  it('clears a grown-up mark too, and leaves other items alone', () => {
    const marked = markMastered(markMastered(createProgress(), 'ls:s', 1), 'ls:a', 1);
    const after = unmarkMastered(marked, 'ls:s');
    expect(after.items['ls:s'].parentMarked).toBeUndefined();
    expect(isMastered(after, 'ls:a')).toBe(true);
  });
});

describe('introductions', () => {
  it('starts with nothing met, and remembers each sound once', () => {
    const fresh = createProgress();
    expect(fresh.introduced).toEqual([]);
    const met = markIntroduced(markIntroduced(fresh, 's'), 's');
    expect(met.introduced).toEqual(['s']);
    expect(hasMet(met, 's')).toBe(true);
    expect(hasMet(fresh, 's')).toBe(false);
    expect(fresh.introduced).toEqual([]);
  });

  it('treats progress saved before introductions existed as nothing met', () => {
    const { introduced, ...older } = createProgress();
    expect(introduced).toEqual([]);
    expect(hasMet(older, 's')).toBe(false);
    expect(markIntroduced(older, 'a').introduced).toEqual(['a']);
  });
});

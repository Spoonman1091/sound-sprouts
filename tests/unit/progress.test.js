import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import {
  createProgress, recordAttempt, recordSession, isMastered, isStruggling, lastSeen, setChildName,
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
  it('needs MASTERY_STREAK first-try successes across two sessions', () => {
    let p = attempt(createProgress(), 'ls:s', true, 's1', 1);
    p = attempt(p, 'ls:s', true, 's1', 2);
    expect(isMastered(p, 'ls:s')).toBe(false);
    p = attempt(p, 'ls:s', true, 's2', 3);
    expect(isMastered(p, 'ls:s')).toBe(true);
    expect(p.items['ls:s'].masteredAt).toBe(3);
  });

  it('does not master when all successes are in one session', () => {
    const p = [1, 2, 3].reduce((acc, at) => attempt(acc, 'ls:s', true, 's1', at), createProgress());
    expect(isMastered(p, 'ls:s')).toBe(false);
  });

  it('does not master when a miss is inside the streak', () => {
    let p = attempt(createProgress(), 'ls:s', true, 's1', 1);
    p = attempt(p, 'ls:s', false, 's2', 2);
    p = attempt(p, 'ls:s', true, 's2', 3);
    expect(isMastered(p, 'ls:s')).toBe(false);
  });

  it('stays mastered after a later miss', () => {
    let p = [['s1', 1], ['s1', 2], ['s2', 3]].reduce((acc, [s, at]) => attempt(acc, 'ls:s', true, s, at), createProgress());
    p = attempt(p, 'ls:s', false, 's3', 4);
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

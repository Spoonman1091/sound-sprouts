import { vi } from 'vitest';

// mulberry32: deterministic rng for repeatable tests
export function seededRng(seed = 1) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fakePlayer(overrides = {}) {
  return {
    play: vi.fn(async () => ({ ok: true })),
    playSequence: vi.fn(async () => ({ ok: true })),
    say: vi.fn(async () => ({ ok: true })),
    stop: vi.fn(),
    ...overrides,
  };
}

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

import { createProgress, recordAttempt } from '../src/state/progress.js';

// Master each id with 3 first-try successes across sessions m1..m3 (at = 1..3).
export function withMastered(progress = createProgress(), ids = []) {
  return ids.reduce(
    (p, itemId) => [1, 2, 3].reduce(
      (acc, n) => recordAttempt(acc, { itemId, firstTry: true, sessionId: `m${n}`, at: n }), p),
    progress,
  );
}

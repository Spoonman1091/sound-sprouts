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
    suspend: vi.fn(),
    resume: vi.fn(),
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
import { CONFIG } from '../src/config.js';

// Master each id with MASTERY_STREAK first-try successes, each in its own session m1, m2, ...
const STREAK = Array.from({ length: CONFIG.MASTERY_STREAK }, (_, i) => i + 1);
export function withMastered(progress = createProgress(), ids = []) {
  return ids.reduce(
    (p, itemId) => STREAK.reduce(
      (acc, n) => recordAttempt(acc, { itemId, firstTry: true, sessionId: `m${n}`, at: n }), p),
    progress,
  );
}

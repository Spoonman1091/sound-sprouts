import { CONFIG } from '../config.js';

export function createProgress() {
  return { version: CONFIG.SCHEMA_VERSION, childName: '', items: {}, sessions: [] };
}

const attemptsOf = (progress, itemId) => progress.items[itemId]?.attempts ?? [];

const CURRENT_RULE = Object.freeze({ streak: CONFIG.MASTERY_STREAK, minSessions: CONFIG.MASTERY_MIN_SESSIONS });

// Mastered = the last `streak` tries were all right on the first tap, spread over `minSessions` lessons.
// A wrong tap anywhere in that window means not mastered yet.
export function meetsMastery(attempts, { streak, minSessions } = CURRENT_RULE) {
  const recent = attempts.slice(-streak);
  if (recent.length < streak) return false;
  const sessions = new Set(recent.map((a) => a.sessionId));
  return recent.every((a) => a.firstTry) && sessions.size >= minSessions;
}

export function recordAttempt(progress, { itemId, firstTry, sessionId, at }) {
  const previous = progress.items[itemId] ?? { attempts: [], masteredAt: null };
  const attempts = [...previous.attempts, { firstTry, sessionId, at }].slice(-CONFIG.ATTEMPT_HISTORY);
  const masteredAt = previous.masteredAt ?? (meetsMastery(attempts) ? at : null);
  return { ...progress, items: { ...progress.items, [itemId]: { attempts, masteredAt } } };
}

export function recordSession(progress, { sessionId, at, itemCount }) {
  const sessions = [...progress.sessions, { sessionId, at, itemCount }].slice(-CONFIG.SESSION_HISTORY);
  return { ...progress, sessions };
}

export const isMastered = (progress, itemId) => Boolean(progress.items[itemId]?.masteredAt);

// A grown-up vouching for something she already knows. Attempts are kept, so review still checks it.
export function markMastered(progress, itemId, at) {
  const previous = progress.items[itemId] ?? { attempts: [], masteredAt: null };
  const masteredAt = previous.masteredAt ?? at;
  return { ...progress, items: { ...progress.items, [itemId]: { ...previous, masteredAt, parentMarked: true } } };
}

export function isStruggling(progress, itemId) {
  const recent = attemptsOf(progress, itemId).slice(-CONFIG.STRUGGLE_WINDOW);
  return recent.filter((a) => !a.firstTry).length >= CONFIG.STRUGGLE_MISSES;
}

export function lastSeen(progress, itemId) {
  const attempts = attemptsOf(progress, itemId);
  return attempts.length ? attempts[attempts.length - 1].at : 0;
}

export const setChildName = (progress, childName) => ({ ...progress, childName });

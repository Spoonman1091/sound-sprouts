import { CONFIG } from '../config.js';
import { meetsMastery } from './progress.js';

// Version 1 mastered a sound after 3 first-try successes over 2 lessons and did not record
// which sounds a parent marked. Re-check what it mastered against the current, stricter rule.
const V1_RULE = Object.freeze({ streak: 3, minSessions: 2 });

function migrateItemFromV1(item) {
  if (!item.masteredAt) return item;
  if (meetsMastery(item.attempts, V1_RULE)) {
    return meetsMastery(item.attempts) ? item : { ...item, masteredAt: null };
  }
  // Mastered without meeting the old rule: marked by a parent (no tries yet), or earned and later
  // missed, which stays mastered as before.
  return item.attempts.length === 0 ? { ...item, parentMarked: true } : item;
}

export function migrateProgress(data) {
  if (data.version === CONFIG.SCHEMA_VERSION) return data;
  const items = Object.fromEntries(Object.entries(data.items).map(([id, item]) => [id, migrateItemFromV1(item)]));
  return { ...data, version: CONFIG.SCHEMA_VERSION, items };
}

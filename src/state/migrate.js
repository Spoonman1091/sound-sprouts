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

// Saves from before introductions existed have no list of met sounds: count sounds she has already
// practised as met, so she is not re-introduced to them. A damaged list is cleaned, not rejected.
const practisedSounds = (items) => Object.entries(items)
  .filter(([id, item]) => id.startsWith('ls:') && item.attempts.length > 0)
  .map(([id]) => id.slice('ls:'.length));

const withIntroduced = (data) => ({
  ...data,
  introduced: Array.isArray(data.introduced) ? data.introduced.filter((s) => typeof s === 'string') : practisedSounds(data.items),
});

export function migrateProgress(data) {
  if (data.version === CONFIG.SCHEMA_VERSION) return withIntroduced(data);
  const items = Object.fromEntries(Object.entries(data.items).map(([id, item]) => [id, migrateItemFromV1(item)]));
  return withIntroduced({ ...data, version: CONFIG.SCHEMA_VERSION, items });
}

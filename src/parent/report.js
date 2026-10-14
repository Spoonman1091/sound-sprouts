import { CONFIG } from '../config.js';
import { RHYME_SETS, SIGHT_WORDS } from '../curriculum/units.js';
import { isMastered, isStruggling } from '../state/progress.js';

export const STATUS_LABELS = Object.freeze({
  seed: 'Not started', sprout: 'Learning', flower: 'Mastered', thirsty: 'Needs review',
});

export function firstTryRate(progress, itemId) {
  const attempts = progress.items[itemId]?.attempts ?? [];
  if (attempts.length === 0) return null;
  return Math.round((100 * attempts.filter((a) => a.firstTry).length) / attempts.length);
}

export function describeItem(itemId) {
  const [kind, arg] = itemId.split(':');
  const labels = {
    ls: () => `Letter sound “${arg}”`,
    fs: () => `First sound “${arg}”`,
    blend: () => `Blending “${arg}”`,
    rhyme: () => `Rhyming: ${(RHYME_SETS[Number(arg)] ?? []).join(', ')}`,
    name: () => 'Spelling their name',
    sight: () => `Sight word “${SIGHT_WORDS[arg] ?? arg}”`,
  };
  return labels[kind] ? labels[kind]() : itemId;
}

export const practiceList = (progress) =>
  Object.keys(progress.items).filter((id) => isStruggling(progress, id)).map(describeItem);

export const sessionsInLastDays = (progress, days, now) =>
  progress.sessions.filter((s) => s.at >= now - days * CONFIG.DAY_MS).length;

export const rhymesMastered = (progress) =>
  RHYME_SETS.filter((_, i) => isMastered(progress, `rhyme:${i}`)).length;

export function sightWordStatus(progress, id) {
  const itemId = `sight:${id}`;
  if (isMastered(progress, itemId)) return isStruggling(progress, itemId) ? 'thirsty' : 'flower';
  return progress.items[itemId]?.attempts.length ? 'sprout' : 'seed';
}

export const sightWordsMastered = (progress) =>
  Object.keys(SIGHT_WORDS).filter((w) => isMastered(progress, `sight:${w}`)).length;

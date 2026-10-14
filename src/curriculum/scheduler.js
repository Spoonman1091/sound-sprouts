import { CONFIG } from '../config.js';
import { RHYME_SETS, FIRST_SOUND_WORDS, BLEND_WORDS } from './units.js';
import { unlockedLetters } from './unlock.js';
import { shuffle } from './random.js';
import { isMastered, isStruggling, lastSeen } from '../state/progress.js';
import { nameLetters } from '../state/name.js';

const isRhyme = (id) => id.startsWith('rhyme:');

export function availableItems(progress) {
  const letters = unlockedLetters(progress);
  const masteredLetters = letters.filter((l) => isMastered(progress, `ls:${l}`));
  const letterItems = letters.flatMap((l) => (FIRST_SOUND_WORDS[l] ? [`ls:${l}`, `fs:${l}`] : [`ls:${l}`]));
  const blendItems = BLEND_WORDS
    .filter((w) => [...w].every((ch) => masteredLetters.includes(ch)))
    .map((w) => `blend:${w}`);
  const nameItems = nameLetters(progress.childName).length > 0 ? ['name'] : [];
  return [...nameItems, ...RHYME_SETS.map((_, i) => `rhyme:${i}`), ...letterItems, ...blendItems];
}

export function sortForReview(progress, ids) {
  return [...ids].sort((a, b) =>
    Number(isStruggling(progress, b)) - Number(isStruggling(progress, a))
    || lastSeen(progress, a) - lastSeen(progress, b));
}

export function interleave(a, b) {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]])
    .flat()
    .filter((x) => x !== undefined);
}

export const dedupeAdjacent = (ids) => ids.filter((id, i) => id !== ids[i - 1]);

// Second showings of focus items come before review; if a repeat would land right after itself, slip a review item in between.
function repeatsThenReview(firstPass, focus, review) {
  const [head, ...tail] = review;
  const collides = focus.length > 0 && focus[0] === firstPass[firstPass.length - 1];
  return collides && head ? [head, ...focus, ...tail] : [...focus, ...review];
}

function pickWarmup(progress, available) {
  if (available.includes('name') && !isMastered(progress, 'name')) return 'name';
  return sortForReview(progress, available.filter(isRhyme))[0];
}

export function planSession(progress, rng = Math.random) {
  const available = availableItems(progress);
  const warmup = pickWarmup(progress, available);
  const rest = available.filter((id) => id !== warmup);
  const focus = shuffle(rest.filter((id) => !isRhyme(id) && !isMastered(progress, id)), rng)
    .slice(0, CONFIG.FOCUS_ITEMS);
  const rhymes = shuffle(rest.filter((id) => isRhyme(id) && !isMastered(progress, id)), rng)
    .slice(0, CONFIG.MAX_RHYMES_PER_SESSION);
  const review = sortForReview(progress, rest.filter((id) => isMastered(progress, id)));
  const firstPass = interleave(focus, rhymes);
  const body = [...firstPass, ...repeatsThenReview(firstPass, focus, review)];
  return dedupeAdjacent([warmup, ...body]).slice(0, CONFIG.SESSION_LENGTH);
}

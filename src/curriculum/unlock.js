import { CONFIG } from '../config.js';
import { LETTER_ORDER } from './units.js';
import { isMastered, isStruggling } from '../state/progress.js';

export function unlockedLetters(progress) {
  const firstUnmastered = LETTER_ORDER.findIndex((l) => !isMastered(progress, `ls:${l}`));
  const masteredPrefix = firstUnmastered === -1 ? LETTER_ORDER.length : firstUnmastered;
  const count = Math.min(LETTER_ORDER.length, Math.max(CONFIG.MIN_UNLOCKED_LETTERS, masteredPrefix + 1));
  return LETTER_ORDER.slice(0, count);
}

export function letterStatus(progress, letter) {
  const id = `ls:${letter}`;
  if (isMastered(progress, id)) return isStruggling(progress, id) ? 'thirsty' : 'flower';
  return unlockedLetters(progress).includes(letter) ? 'sprout' : 'seed';
}

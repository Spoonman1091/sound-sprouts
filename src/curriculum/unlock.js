import { CONFIG } from '../config.js';
import { LETTER_ORDER, FIRST_SOUND_WORDS } from './units.js';
import { isMastered, isStruggling, markMastered } from '../state/progress.js';

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

export function markLetterMastered(progress, letter, at) {
  const ids = FIRST_SOUND_WORDS[letter] ? [`ls:${letter}`, `fs:${letter}`] : [`ls:${letter}`];
  return ids.reduce((acc, id) => markMastered(acc, id, at), progress);
}

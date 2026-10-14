import { CONFIG } from '../config.js';
import { BLEND_WORDS, graphemes, isLongWord } from './units.js';
import { isMastered } from '../state/progress.js';

const masteredShortBlends = (progress) =>
  BLEND_WORDS.filter((w) => !isLongWord(w) && isMastered(progress, `blend:${w}`)).length;

// Blend words whose sounds are all mastered. Longer words (frog, plant) wait until
// enough short ones are mastered, so consonant blends come after simple three-sound words.
export function readyBlends(progress, masteredLetters) {
  const longReady = masteredShortBlends(progress) >= CONFIG.LONG_WORD_MIN_BLENDS;
  return BLEND_WORDS.filter((w) =>
    (longReady || !isLongWord(w)) && graphemes(w).every((g) => masteredLetters.includes(g)));
}

export const PROMPT_IDS = Object.freeze([
  'which_starts_with', 'which_rhymes_with', 'find_the_letter', 'tap_each_letter',
  'which_picture', 'spell_your_name', 'great_job_1', 'great_job_2', 'great_job_3',
  'try_again', 'all_done', 'new_flower', 'lets_play',
]);

import { PHONEME_SOURCE } from '../curriculum/units.js';

const clipPath = (kind, id) => `assets/audio/${kind}/${id}.mp3`;

export const phoneme = (id) => clipPath('phoneme', PHONEME_SOURCE[id] ?? id);
export const letterName = (id) => clipPath('letter', id);
export const word = (id) => clipPath('word', id);
export const imgPath = (id) => `assets/img/${id}.svg`;

export function prompt(id) {
  if (!PROMPT_IDS.includes(id)) throw new Error(`Unknown prompt: ${id}`);
  return clipPath('prompt', id);
}

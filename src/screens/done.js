import { LETTER_ORDER } from '../curriculum/units.js';
import { isMastered } from '../state/progress.js';
import { prompt } from '../audio/clips.js';
import { renderHome } from './home.js';
import { settle } from '../activities/settle.js';

export const newlyBloomed = (before, after) => LETTER_ORDER.filter(
  (l) => !isMastered(before, `ls:${l}`) && isMastered(after, `ls:${l}`));

// After a lesson she lands straight back in the garden, with any new flower blooming, so she can
// pick her next letter (or Play) without first tapping a Home button.
export function renderDone(container, { before, after, player, onPlay, onPick, onParent, wait, settleMs }) {
  const bloomed = newlyBloomed(before, after);
  renderHome(container, { progress: after, bloomed, onPlay, onPick, onParent });
  const clips = bloomed.length ? [prompt('new_flower'), prompt('all_done')] : [prompt('all_done')];
  return settle({ wait, settleMs }).then(() => player.playSequence(clips));
}

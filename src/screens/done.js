import { el } from '../ui/dom.js';
import { LETTER_ORDER } from '../curriculum/units.js';
import { isMastered } from '../state/progress.js';
import { imgPath, prompt } from '../audio/clips.js';
import { renderGarden } from './garden.js';
import { settle } from '../activities/settle.js';

export const newlyBloomed = (before, after) => LETTER_ORDER.filter(
  (l) => !isMastered(before, `ls:${l}`) && isMastered(after, `ls:${l}`));

export function renderDone(container, { before, after, player, onHome, wait, settleMs }) {
  const bloomed = newlyBloomed(before, after);
  const home = el('button', { class: 'home-button', 'aria-label': 'Back to the garden' },
    [el('img', { src: imgPath('house'), alt: '' })]);
  home.addEventListener('click', () => { player.stop(); onHome(); }, { once: true });
  container.replaceChildren(el('div', { class: 'done' }, [renderGarden(after, { bloomed }), home]));
  const clips = bloomed.length ? [prompt('new_flower'), prompt('all_done')] : [prompt('all_done')];
  return settle({ wait, settleMs }).then(() => player.playSequence(clips));
}

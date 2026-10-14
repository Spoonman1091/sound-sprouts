import { el } from '../ui/dom.js';
import { letterName, prompt } from '../audio/clips.js';
import { settle } from './settle.js';

function renderNameSpell(task) {
  const slots = task.letters.map(() => el('span', { class: 'slot' }));
  const tiles = task.tileOrder.map((index) => {
    const letter = task.letters[index];
    return el('button', { class: 'tile', 'aria-label': letter.display, dataset: { char: letter.display, key: letter.key } }, [letter.display]);
  });
  const root = el('div', { class: 'activity name-spell', dataset: { ready: 'false' } },
    [el('div', { class: 'slots' }, slots), el('div', { class: 'tiles' }, tiles)]);
  return { root, slots, tiles };
}

export function runNameSpell(container, task, deps) {
  const { player } = deps;
  return new Promise((resolve) => {
    const { root, slots, tiles } = renderNameSpell(task);
    let ready = false;
    let next = 0;
    let firstTry = true;
    const setReady = (value) => { ready = value; root.dataset.ready = String(value); };

    const onWrong = async (tile) => {
      firstTry = false;
      slots[next].dataset.hint = task.letters[next].display;
      tile.classList.add('wobble');
      await player.play(prompt('try_again'));
      tile.classList.remove('wobble');
      setReady(true);
    };

    const onRight = async (tile) => {
      const letter = task.letters[next];
      tile.disabled = true;
      slots[next].textContent = letter.display;
      next += 1;
      await player.play(letterName(letter.key));
      if (next < task.letters.length) { setReady(true); return; }
      await player.say(task.name);
      await player.play(task.cheer);
      resolve({ firstTry });
    };

    tiles.forEach((tile) => tile.addEventListener('click', () => {
      if (!ready || tile.disabled) return;
      setReady(false);
      if (tile.dataset.char === task.letters[next].display) onRight(tile);
      else onWrong(tile);
    }));

    container.replaceChildren(root);
    settle(deps)
      .then(() => player.play(prompt('spell_your_name')))
      .then(() => setReady(true));
  });
}

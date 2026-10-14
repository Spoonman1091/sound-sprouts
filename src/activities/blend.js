import { el } from '../ui/dom.js';
import { phoneme, word, prompt, imgPath } from '../audio/clips.js';
import { runPickOne } from './pick-one.js';

function renderBlend(task) {
  const tiles = task.letters.map((letter, index) =>
    el('button', { class: 'tile', 'aria-label': letter, dataset: { index: String(index) } }, [letter]));
  const hop = el('button', { class: 'hop', 'aria-label': 'Hop the sounds together', hidden: '' },
    [el('img', { src: imgPath('seedling'), alt: '' })]);
  const choiceStage = el('div', { class: 'blend-choices' });
  const root = el('div', { class: 'activity blend', dataset: { ready: 'false' } },
    [el('div', { class: 'tiles' }, tiles), hop, choiceStage]);
  return { root, tiles, hop, choiceStage };
}

export function runBlend(container, task, { player }) {
  return new Promise((resolve) => {
    const { root, tiles, hop, choiceStage } = renderBlend(task);
    let ready = false;
    let next = 0;
    const setReady = (value) => { ready = value; root.dataset.ready = String(value); };

    tiles.forEach((tile, index) => tile.addEventListener('click', async () => {
      if (!ready || index !== next) return;
      setReady(false);
      tile.classList.add('heard');
      next = index + 1;
      await player.play(phoneme(task.letters[index]));
      hop.hidden = next < tiles.length;
      setReady(true);
    }));

    hop.addEventListener('click', async () => {
      if (!ready || next < tiles.length) return;
      setReady(false);
      hop.hidden = true;
      await player.playSequence([...task.letters.map(phoneme), word(task.word)]);
      const pickTask = { prompt: [prompt('which_picture')], choices: task.choices, cheer: task.cheer };
      resolve(await runPickOne(choiceStage, pickTask, { player }));
    });

    container.replaceChildren(root);
    player.play(prompt('tap_each_letter')).then(() => setReady(true));
  });
}

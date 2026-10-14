import { el } from '../ui/dom.js';
import { prompt } from '../audio/clips.js';

function choiceFace(choice) {
  return choice.img
    ? el('img', { src: choice.img, alt: '', draggable: 'false' })
    : el('span', { class: 'letter' }, [choice.label]);
}

function renderPickOne(task) {
  const replay = el('button', { class: 'replay', 'aria-label': 'Hear it again' }, ['🔊']);
  const buttons = task.choices.map((choice) => el('button', {
    class: 'choice',
    'aria-label': choice.label,
    dataset: { choiceId: choice.id, correct: String(choice.correct) },
  }, [choiceFace(choice)]));
  const focus = task.focusImg ? el('img', { class: 'focus', src: task.focusImg, alt: '' }) : null;
  const root = el('div', { class: 'activity pick-one', dataset: { ready: 'false' } },
    [replay, focus, el('div', { class: 'choices' }, buttons)]);
  return { root, replay, buttons };
}

export function runPickOne(container, task, { player }) {
  return new Promise((resolve) => {
    const { root, replay, buttons } = renderPickOne(task);
    let ready = false;
    let firstTry = true;
    const setReady = (value) => { ready = value; root.dataset.ready = String(value); };

    const ask = async () => {
      setReady(false);
      await player.playSequence(task.prompt);
      setReady(true);
    };

    const onWrong = async (choice, button) => {
      firstTry = false;
      setReady(false);
      button.classList.add('wrong');
      button.disabled = true;
      if (choice.audio) await player.play(choice.audio);
      await player.play(prompt('try_again'));
      await ask();
    };

    const onRight = async (button) => {
      setReady(false);
      button.classList.add('right');
      await player.play(task.cheer);
      resolve({ firstTry });
    };

    buttons.forEach((button, index) => button.addEventListener('click', () => {
      if (!ready) return;
      const choice = task.choices[index];
      if (choice.correct) onRight(button);
      else onWrong(choice, button);
    }));
    replay.addEventListener('click', () => { if (ready) ask(); });

    container.replaceChildren(root);
    ask();
  });
}

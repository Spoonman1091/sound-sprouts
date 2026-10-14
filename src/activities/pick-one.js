import { el } from '../ui/dom.js';
import { prompt } from '../audio/clips.js';
import { settle } from './settle.js';

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
  const focus = task.focusImg
    ? el('button', { class: 'focus', 'aria-label': task.focusLabel ?? '' }, [el('img', { src: task.focusImg, alt: '' })])
    : null;
  const root = el('div', { class: 'activity pick-one', dataset: { ready: 'false' } },
    [replay, focus, el('div', { class: 'choices' }, buttons)]);
  return { root, replay, buttons, focus };
}

export function runPickOne(container, task, deps) {
  const { player } = deps;
  return new Promise((resolve) => {
    const { root, replay, buttons, focus } = renderPickOne(task);
    let ready = false;
    let firstTry = true;
    const setReady = (value) => { ready = value; root.dataset.ready = String(value); };

    // Light up each picture still in play while its word is said, so she knows what every option is.
    const narrate = async () => {
      const remaining = buttons.filter((button) => !button.disabled);
      for (const button of remaining) {
        button.classList.add('narrating');
        await player.play(task.choices[buttons.indexOf(button)].audio);
        button.classList.remove('narrating');
      }
    };

    const ask = async () => {
      setReady(false);
      await player.playSequence(task.prompt);
      if (task.narrate) {
        root.dataset.narrating = 'true';
        await narrate();
        delete root.dataset.narrating;
      }
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

    const onRight = async (choice, button) => {
      setReady(false);
      button.classList.add('right');
      if (choice.audio) await player.play(choice.audio);
      await player.play(task.cheer);
      resolve({ firstTry });
    };

    buttons.forEach((button, index) => button.addEventListener('click', () => {
      if (!ready) return;
      const choice = task.choices[index];
      if (choice.correct) onRight(choice, button);
      else onWrong(choice, button);
    }));
    replay.addEventListener('click', () => { if (ready) ask(); });
    // The big picture just says its word again; it is not an answer.
    focus?.addEventListener('click', async () => {
      if (!ready || !task.focusAudio) return;
      setReady(false);
      await player.play(task.focusAudio);
      setReady(true);
    });

    container.replaceChildren(root);
    settle(deps).then(ask);
  });
}

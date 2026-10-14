import { el } from '../ui/dom.js';
import { prompt } from '../audio/clips.js';
import { settle, pause } from './settle.js';

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
  const { player, wait = pause, leadInGapMs = 0, questionGapMs = 0, narrateGapMs = 0 } = deps;
  const hold = (ms) => (ms > 0 ? wait(ms) : Promise.resolve());
  return new Promise((resolve) => {
    const { root, replay, buttons, focus } = renderPickOne(task);
    let ready = false;
    let firstTry = true;
    const setReady = (value) => { ready = value; root.dataset.ready = String(value); };

    // After a pause to let the question sink in, light up each choice still in play while it is named,
    // lingering a moment on each so she can take it in.
    const narrate = async () => {
      const remaining = buttons.filter((button) => !button.disabled);
      await hold(questionGapMs);
      for (const button of remaining) {
        button.classList.add('narrating');
        const choice = task.choices[buttons.indexOf(button)];
        for (const clip of choice.narration ?? [choice.audio]) await player.play(clip);
        await hold(narrateGapMs);
        button.classList.remove('narrating');
      }
    };

    // "Which one rhymes with... [pause] cat", so the word stands out from the lead-in.
    const playQuestion = async () => {
      if (!task.pauseAfterLeadIn) return player.playSequence(task.prompt);
      const [leadIn, ...rest] = task.prompt;
      await player.playSequence([leadIn]);
      await hold(leadInGapMs);
      return player.playSequence(rest);
    };

    const ask = async () => {
      setReady(false);
      await playQuestion();
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

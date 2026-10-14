import { el } from '../ui/dom.js';
import { shuffle } from '../curriculum/random.js';

export function makeQuestion(rng = Math.random) {
  const a = 3 + Math.floor(rng() * 7);
  const b = 3 + Math.floor(rng() * 7);
  const answer = a + b;
  return { text: `${a} + ${b}`, answer, options: shuffle([answer, answer + 1, answer - 2, answer + 3], rng) };
}

export function renderGate(container, { rng = Math.random, onPass, onCancel }) {
  const question = makeQuestion(rng);
  const options = question.options.map((n) => {
    const button = el('button', { class: 'gate-option' }, [String(n)]);
    button.addEventListener('click', () => (n === question.answer ? onPass() : onCancel()));
    return button;
  });
  const back = el('button', { class: 'link' }, ['Back']);
  back.addEventListener('click', onCancel);
  container.replaceChildren(el('div', { class: 'gate' }, [
    el('h2', {}, ['Grown-ups only']),
    el('p', {}, [`What is ${question.text}?`]),
    el('div', { class: 'gate-options' }, options),
    back,
  ]));
}

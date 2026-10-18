import { el } from '../ui/dom.js';
import { LETTER_ORDER } from '../curriculum/units.js';
import { letterStatus } from '../curriculum/unlock.js';
import { imgPath } from '../audio/clips.js';

const STATUS_IMAGE = Object.freeze({ sprout: 'seedling', flower: 'tulip', thirsty: 'wilted_flower' });

function plotFace(status) {
  const image = STATUS_IMAGE[status];
  return image ? el('img', { src: imgPath(image), alt: '' }) : el('span', { class: 'seed' });
}

// With onMeet, open plots are buttons that replay the letter's introduction; seeds stay closed.
function renderPlot(progress, letter, { bloomed, onMeet }) {
  const status = letterStatus(progress, letter);
  const bloom = bloomed.includes(letter) ? ' bloom' : '';
  const face = [plotFace(status), el('span', { class: 'plot-letter', 'aria-hidden': 'true' }, [letter])];
  const props = { class: `plot ${status}${bloom}`, dataset: { letter, status } };
  if (!onMeet || status === 'seed') return el('div', { ...props, 'aria-hidden': 'true' }, face);
  const button = el('button', { ...props, 'aria-label': `Meet ${letter}` }, face);
  button.addEventListener('click', () => onMeet(letter));
  return button;
}

export function renderGarden(progress, { bloomed = [], onMeet } = {}) {
  return el('div', { class: 'garden' }, LETTER_ORDER.map((letter) => renderPlot(progress, letter, { bloomed, onMeet })));
}

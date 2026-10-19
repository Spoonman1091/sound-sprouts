import { el } from '../ui/dom.js';
import { LETTER_ORDER } from '../curriculum/units.js';
import { letterStatus, unlockedLetters } from '../curriculum/unlock.js';
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

// Single letters first, then the letter teams (sh, ee, igh, ...) once those are in reach.
const PAGES = Object.freeze([
  LETTER_ORDER.filter((l) => l.length === 1),
  LETTER_ORDER.filter((l) => l.length > 1),
]);

const pageOf = (letter) => PAGES.findIndex((page) => page.includes(letter));

// The page she is working on: where a flower just bloomed, else where her newest letter is.
const startPage = (progress, bloomed) => pageOf(bloomed.at(-1) ?? unlockedLetters(progress).at(-1));

export function renderGarden(progress, { bloomed = [], onMeet } = {}) {
  const grid = el('div', { class: 'garden' });
  const prev = el('button', { class: 'garden-page-prev', 'aria-label': 'Previous page' }, ['‹']);
  const next = el('button', { class: 'garden-page-next', 'aria-label': 'Next page' }, ['›']);
  const dots = PAGES.map((_, i) => el('span', { class: 'page-dot', dataset: { page: String(i) } }));
  let current = 0;
  const show = (page) => {
    grid.replaceChildren(...PAGES[page].map((letter) => renderPlot(progress, letter, { bloomed, onMeet })));
    prev.hidden = page === 0;
    next.hidden = page === PAGES.length - 1;
    dots.forEach((dot, i) => dot.classList.toggle('current', i === page));
    current = page;
  };
  prev.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  show(startPage(progress, bloomed));
  return el('div', { class: 'garden-pages' }, [
    el('div', { class: 'garden-row' }, [prev, grid, next]),
    el('div', { class: 'garden-dots', 'aria-hidden': 'true' }, dots),
  ]);
}

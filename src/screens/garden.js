import { el } from '../ui/dom.js';
import { LETTER_ORDER } from '../curriculum/units.js';
import { letterStatus } from '../curriculum/unlock.js';
import { imgPath } from '../audio/clips.js';

const STATUS_IMAGE = Object.freeze({ sprout: 'seedling', flower: 'tulip', thirsty: 'wilted_flower' });

function plotFace(status) {
  const image = STATUS_IMAGE[status];
  return image ? el('img', { src: imgPath(image), alt: '' }) : el('span', { class: 'seed' });
}

export function renderGarden(progress, { bloomed = [] } = {}) {
  return el('div', { class: 'garden', 'aria-hidden': 'true' }, LETTER_ORDER.map((letter) => {
    const status = letterStatus(progress, letter);
    const bloom = bloomed.includes(letter) ? ' bloom' : '';
    return el('div', { class: `plot ${status}${bloom}`, dataset: { letter, status } },
      [plotFace(status), el('span', { class: 'plot-letter' }, [letter])]);
  }));
}

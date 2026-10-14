import { el } from '../ui/dom.js';
import { imgPath } from '../audio/clips.js';
import { CONFIG } from '../config.js';
import { onLongPress } from '../ui/long-press.js';
import { renderGarden } from './garden.js';

export function renderHome(container, { progress, onPlay, onParent }) {
  const play = el('button', { class: 'play', 'aria-label': 'Play' },
    [el('img', { src: imgPath('seedling'), alt: '' }), el('span', { 'aria-hidden': 'true' }, ['Play'])]);
  play.addEventListener('click', onPlay, { once: true });
  const gear = el('button', { class: 'parent-gear', 'aria-label': 'Grown-ups: press and hold' }, ['⚙']);
  onLongPress(gear, CONFIG.PARENT_HOLD_MS, onParent);
  container.replaceChildren(el('div', { class: 'home' }, [
    gear,
    el('h1', { class: 'title' }, ['Sound Sprouts']),
    renderGarden(progress),
    play,
  ]));
}

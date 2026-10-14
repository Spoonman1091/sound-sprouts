import { el } from '../ui/dom.js';
import { LETTER_ORDER } from '../curriculum/units.js';
import { readyBlends } from '../curriculum/blends.js';
import { unlockedLetters } from '../curriculum/unlock.js';
import { isMastered } from '../state/progress.js';
import { imgPath } from '../audio/clips.js';

export const minibookWords = (progress) =>
  readyBlends(progress, LETTER_ORDER.filter((l) => isMastered(progress, `ls:${l}`)));

const wordPage = (w) => el('section', { class: 'mb-page' }, [el('img', { src: imgPath(w), alt: '' }), el('p', { class: 'mb-word' }, [w])]);
const letterPage = (l) => el('section', { class: 'mb-page' }, [el('p', { class: 'mb-letter' }, [l]), el('p', {}, ['Say the sound, then trace it!'])]);

export function renderMinibook(target, progress) {
  const words = minibookWords(progress);
  const pages = words.length ? words.map(wordPage) : unlockedLetters(progress).map(letterPage);
  target.replaceChildren(el('h1', { class: 'mb-title' }, ['My Sound Sprouts Book']), ...pages);
  return pages.length;
}

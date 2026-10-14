import { el } from '../ui/dom.js';
import { CONFIG } from '../config.js';
import { LETTER_ORDER, RHYME_SETS } from '../curriculum/units.js';
import { letterStatus } from '../curriculum/unlock.js';
import { validateChildName } from '../state/name.js';
import { STATUS_LABELS, firstTryRate, practiceList, sessionsInLastDays, rhymesMastered } from './report.js';

const STORAGE_NOTICES = Object.freeze({
  reset: "Saved progress couldn't be read, so Sound Sprouts started fresh.",
  unavailable: "This browser can't save progress (private browsing or storage is full). Progress will be lost when the app closes.",
});

function nameSection(progress, onSaveName) {
  const input = el('input', { id: 'child-name', type: 'text', autocomplete: 'off', maxlength: String(CONFIG.NAME_MAX_LENGTH), value: progress.childName });
  const error = el('p', { class: 'error', role: 'alert' });
  const save = el('button', {}, ['Save name']);
  save.addEventListener('click', () => {
    const result = validateChildName(input.value);
    if (!result.ok) { error.textContent = result.error; return; }
    onSaveName(result.value);
  });
  return el('section', {}, [el('h2', {}, ['Child’s name']), el('label', { for: 'child-name' }, ['Shown only on this tablet']), input, error, save]);
}

function lettersSection(progress) {
  const rows = LETTER_ORDER.map((letter) => {
    const rate = firstTryRate(progress, `ls:${letter}`);
    return el('tr', {}, [
      el('td', {}, [letter]),
      el('td', {}, [STATUS_LABELS[letterStatus(progress, letter)]]),
      el('td', {}, [rate === null ? '—' : `${rate}%`]),
    ]);
  });
  return el('section', {}, [el('h2', {}, ['Letter sounds']), el('table', {}, [
    el('thead', {}, [el('tr', {}, [el('th', {}, ['Letter']), el('th', {}, ['Status']), el('th', {}, ['First-try'])])]),
    el('tbody', {}, rows),
  ])]);
}

function noticesSection(state, onDismissNotice) {
  const count = state.audioErrors.length;
  const storageNotice = STORAGE_NOTICES[state.storageStatus];
  const dismiss = el('button', { class: 'link' }, ['Dismiss']);
  dismiss.addEventListener('click', onDismissNotice);
  return [
    storageNotice ? el('p', { class: 'notice' }, [storageNotice, state.storageStatus === 'reset' ? dismiss : null]) : null,
    count ? el('p', { class: 'notice' }, [`${count} sound${count === 1 ? '' : 's'} didn't play. Check the connection, then reload.`]) : null,
  ].filter(Boolean);
}

export function renderDashboard(container, { state, now = Date.now, confirmFn = (m) => window.confirm(m), onSaveName, onReset, onPrint, onDone, onDismissNotice }) {
  const { progress } = state;
  const practice = practiceList(progress);
  const action = (label, handler, cls = '') => {
    const button = el('button', { class: cls }, [label]);
    button.addEventListener('click', handler);
    return button;
  };
  container.replaceChildren(el('div', { class: 'dashboard' }, [
    el('h1', {}, ['Grown-ups']),
    ...noticesSection(state, onDismissNotice),
    nameSection(progress, onSaveName),
    lettersSection(progress),
    el('section', {}, [
      el('h2', {}, ['This week']),
      el('p', {}, [`${sessionsInLastDays(progress, 7, now())} sessions in the last 7 days · ${rhymesMastered(progress)} of ${RHYME_SETS.length} rhyme sets mastered`]),
      el('h2', {}, ['Needs practice']),
      el('p', {}, [practice.length ? practice.join(' · ') : 'Nothing right now. Great going!']),
    ]),
    el('div', { class: 'actions' }, [
      action('Print a mini-book', onPrint),
      action('Back to the garden', onDone),
      action('Reset progress', () => { if (confirmFn('Erase all learning progress on this tablet? The name is kept.')) onReset(); }, 'danger'),
    ]),
    el('p', {}, [el('a', { href: 'credits.html' }, ['Credits and licenses'])]),
  ]));
}

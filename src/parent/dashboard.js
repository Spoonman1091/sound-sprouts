import { el } from '../ui/dom.js';
import { CONFIG } from '../config.js';
import { LETTER_ORDER, RHYME_SETS, SIGHT_WORDS } from '../curriculum/units.js';
import { letterStatus } from '../curriculum/unlock.js';
import { validateChildName } from '../state/name.js';
import { isMastered } from '../state/progress.js';
import { STATUS_LABELS, STATUS_COLORS, firstTryRate, practiceList, sessionsInLastDays, rhymesMastered, sightWordsMastered, sightWordStatus } from './report.js';

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

function confirmButton(text, question, confirmFn, onConfirm, cls = '') {
  const button = el('button', { class: cls }, [text]);
  button.addEventListener('click', () => { if (confirmFn(question)) onConfirm(); });
  return button;
}

// "Mark mastered" for what she is still learning; "Unmark mastered" to take a mastery back.
function masteryButton(label, mastered, confirmFn, { onMark, onUnmark }) {
  return mastered
    ? confirmButton('Unmark mastered', `Unmark “${label}”? It goes back to learning, and she earns it again with ${CONFIG.MASTERY_STREAK} right in a row.`, confirmFn, onUnmark, 'secondary')
    : confirmButton('Mark mastered', `Mark “${label}” as mastered? It will still come back now and then for review.`, confirmFn, onMark);
}

const statusTable = (cls, heading, firstColumn, rows) => el('section', {}, [el('h2', {}, [heading]), el('table', { class: cls }, [
  el('thead', {}, [el('tr', {}, [el('th', {}, [firstColumn]), el('th', {}, ['Status']), el('th', {}, ['First-try']), el('th', {}, [''])])]),
  el('tbody', {}, rows),
])]);

const statusRow = (label, status, rate, button) => el('tr', {}, [
  el('td', {}, [label]),
  el('td', {}, [el('span', { class: 'status', dataset: { color: STATUS_COLORS[status] } }, [STATUS_LABELS[status]])]),
  el('td', {}, [rate === null ? '—' : `${rate}%`]),
  el('td', {}, [button]),
]);

function lettersSection(progress, { confirmFn, onMarkMastered, onUnmarkMastered }) {
  const rows = LETTER_ORDER.map((letter) => statusRow(
    letter,
    letterStatus(progress, letter),
    firstTryRate(progress, `ls:${letter}`),
    masteryButton(letter, isMastered(progress, `ls:${letter}`), confirmFn, {
      onMark: () => onMarkMastered(letter), onUnmark: () => onUnmarkMastered(letter),
    }),
  ));
  return statusTable('letters', 'Letter sounds', 'Letter', rows);
}

function sightWordsSection(progress, { confirmFn, onMarkSightWordMastered, onUnmarkSightWordMastered }) {
  const rows = Object.entries(SIGHT_WORDS).map(([id, text]) => statusRow(
    text,
    sightWordStatus(progress, id),
    firstTryRate(progress, `sight:${id}`),
    masteryButton(text, isMastered(progress, `sight:${id}`), confirmFn, {
      onMark: () => onMarkSightWordMastered(id), onUnmark: () => onUnmarkSightWordMastered(id),
    }),
  ));
  return statusTable('sight-words', 'Sight words', 'Word', rows);
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

export function renderDashboard(container, { state, now = Date.now, confirmFn = (m) => window.confirm(m), onSaveName, onReset, onPrint, onDone, onDismissNotice, onMarkMastered, onMarkSightWordMastered, onUnmarkMastered, onUnmarkSightWordMastered }) {
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
    lettersSection(progress, { confirmFn, onMarkMastered, onUnmarkMastered }),
    sightWordsSection(progress, { confirmFn, onMarkSightWordMastered, onUnmarkSightWordMastered }),
    el('section', {}, [
      el('h2', {}, ['This week']),
      el('p', {}, [`${sessionsInLastDays(progress, 7, now())} sessions in the last 7 days · ${rhymesMastered(progress)} of ${RHYME_SETS.length} rhyme sets mastered · ${sightWordsMastered(progress)} of ${Object.keys(SIGHT_WORDS).length} sight words mastered`]),
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

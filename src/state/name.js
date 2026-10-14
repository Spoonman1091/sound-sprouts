import { CONFIG } from '../config.js';

const NAME_PATTERN = /^\p{L}[\p{L}\p{M} '\-]*$/u;

export function validateChildName(input) {
  const value = String(input ?? '').trim().replace(/\s+/g, ' ');
  if (value === '') return { ok: true, value };
  if (value.length > CONFIG.NAME_MAX_LENGTH) {
    return { ok: false, error: `Please use ${CONFIG.NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (!NAME_PATTERN.test(value)) {
    return { ok: false, error: 'Please use letters, spaces, hyphens or apostrophes, starting with a letter.' };
  }
  return { ok: true, value };
}

export function nameLetters(name) {
  const firstWord = String(name ?? '').trim().split(/\s+/)[0];
  return [...firstWord]
    .filter((ch) => /\p{L}/u.test(ch))
    .map((ch) => ({ display: ch, key: ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() }));
}

import { describe, it, expect } from 'vitest';
import { validateChildName, nameLetters } from '../../src/state/name.js';

describe('validateChildName', () => {
  it.each([
    ['  Ava  ', 'Ava'],
    ['Mary   Jo', 'Mary Jo'],
    ['Zoë', 'Zoë'],
    ['Mary-Jo', 'Mary-Jo'],
    ["D'Andre", "D'Andre"],
    ['', ''],
  ])('accepts %j as %j', (input, value) => {
    expect(validateChildName(input)).toEqual({ ok: true, value });
  });

  it.each(['Ava2', '-Ava', '<b>', 'x'.repeat(21)])('rejects %j with a message', (input) => {
    const result = validateChildName(input);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/\w/);
  });

  it.each([
    ['D\u2019Arcy', "D'Arcy"],
    ['D\u02BCArcy', "D'Arcy"],
    ['Mary\u2011Jo', 'Mary-Jo'],
    ['Zoe\u0308', 'Zo\u00EB'],
  ])('normalises iPad punctuation and accents: %j → %j', (input, value) => {
    expect(validateChildName(input)).toEqual({ ok: true, value });
  });

  it('treats null/undefined as empty', () => {
    expect(validateChildName(undefined)).toEqual({ ok: true, value: '' });
  });
});

describe('nameLetters', () => {
  it('uses only the first word and keeps case for display', () => {
    expect(nameLetters('Ava Rose')).toEqual([
      { display: 'A', key: 'a' }, { display: 'v', key: 'v' }, { display: 'a', key: 'a' },
    ]);
  });

  it('drops hyphens/apostrophes and strips accents from keys', () => {
    expect(nameLetters("Zoë-D'x").map((l) => l.key).join('')).toBe('zoedx');
    expect(nameLetters('Zoë')[2]).toEqual({ display: 'ë', key: 'e' });
  });

  it('keeps a decomposed accent on its letter', () => {
    expect(nameLetters('Zoe\u0308').map((l) => l.display)).toEqual(['Z', 'o', '\u00EB']);
  });

  it('returns [] for an empty name', () => {
    expect(nameLetters('')).toEqual([]);
    expect(nameLetters('   ')).toEqual([]);
  });
});

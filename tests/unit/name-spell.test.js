import { describe, it, expect } from 'vitest';
import { runNameSpell } from '../../src/activities/name-spell.js';
import { letterName, prompt } from '../../src/audio/clips.js';
import { fakePlayer, flush } from '../helpers.js';

const anna = {
  name: 'Anna',
  cheer: 'cheer.mp3',
  letters: [{ display: 'A', key: 'a' }, { display: 'n', key: 'n' }, { display: 'n', key: 'n' }, { display: 'a', key: 'a' }],
  tileOrder: [3, 1, 0, 2],
};
const tap = async (root, ch) => {
  root.querySelector(`.tile[data-char="${ch}"]:not([disabled])`).click();
  await flush();
};

describe('runNameSpell', () => {
  it('fills slots in order, handles repeated letters, says the name and cheers', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runNameSpell(root, anna, { player });
    await flush();
    for (const ch of ['A', 'n', 'n', 'a']) await tap(root, ch);
    expect([...root.querySelectorAll('.slot')].map((s) => s.textContent).join('')).toBe('Anna');
    expect(player.play).toHaveBeenCalledWith(letterName('a'));
    expect(player.say).toHaveBeenCalledWith('Anna');
    await expect(result).resolves.toEqual({ firstTry: true });
  });

  it('a wrong letter scores firstTry=false and shows a hint in the next slot', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runNameSpell(root, anna, { player });
    await flush();
    await tap(root, 'n');
    expect(player.play).toHaveBeenCalledWith(prompt('try_again'));
    expect(root.querySelector('.slot').dataset.hint).toBe('A');
    expect(root.querySelector('.slot').textContent).toBe('');
    for (const ch of ['A', 'n', 'n', 'a']) await tap(root, ch);
    await expect(result).resolves.toEqual({ firstTry: false });
  });

  it('is case-sensitive: lower-case a does not fill the capital A slot', async () => {
    const root = document.createElement('div');
    runNameSpell(root, anna, { player: fakePlayer() });
    await flush();
    await tap(root, 'a');
    expect(root.querySelector('.slot').textContent).toBe('');
  });

  it('ignores taps before the intro finishes', () => {
    const root = document.createElement('div');
    runNameSpell(root, anna, { player: fakePlayer() });
    root.querySelector('.tile[data-char="A"]').click();
    expect(root.querySelector('.slot').textContent).toBe('');
  });
});

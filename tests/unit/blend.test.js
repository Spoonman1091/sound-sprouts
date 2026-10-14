import { describe, it, expect, vi } from 'vitest';
import { runBlend } from '../../src/activities/blend.js';
import { phoneme, word } from '../../src/audio/clips.js';
import { fakePlayer, flush, deferred } from '../helpers.js';

const task = {
  word: 'pin',
  letters: ['p', 'i', 'n'],
  cheer: 'cheer.mp3',
  choices: [
    { id: 'pin', label: 'pin', img: 'assets/img/pin.svg', audio: word('pin'), correct: true },
    { id: 'tap', label: 'tap', img: 'assets/img/tap.svg', audio: word('tap'), correct: false },
  ],
};
const tile = (root, i) => root.querySelector(`.tile[data-index="${i}"]`);

describe('runBlend', () => {
  it('only accepts tiles left to right, then reveals hop', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    runBlend(root, task, { player });
    await flush();
    const hop = root.querySelector('.hop');
    tile(root, 2).click();
    await flush();
    expect(tile(root, 2).classList.contains('heard')).toBe(false);
    for (const i of [0, 1, 2]) {
      expect(hop.hidden).toBe(true);
      tile(root, i).click();
      await flush();
    }
    expect(player.play).toHaveBeenCalledWith(phoneme('p'));
    expect(hop.hidden).toBe(false);
  });

  it('hop blends the sounds, says the word, then asks for the picture', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runBlend(root, task, { player });
    await flush();
    for (const i of [0, 1, 2]) { tile(root, i).click(); await flush(); }
    root.querySelector('.hop').click();
    await flush();
    expect(player.playSequence).toHaveBeenCalledWith([phoneme('p'), phoneme('i'), phoneme('n'), word('pin')]);
    const correct = root.querySelector('.pick-one [data-correct="true"]');
    expect(correct.dataset.choiceId).toBe('pin');
    correct.click();
    await expect(result).resolves.toEqual({ firstTry: true });
  });

  it('ignores taps before the intro finishes and a double hop', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    runBlend(root, task, { player });
    tile(root, 0).click();
    expect(tile(root, 0).classList.contains('heard')).toBe(false);
    await flush();
    for (const i of [0, 1, 2]) { tile(root, i).click(); await flush(); }
    const hop = root.querySelector('.hop');
    hop.click();
    hop.click();
    await flush();
    expect(player.playSequence.mock.calls.filter(([srcs]) => srcs.includes(word('pin')))).toHaveLength(1);
  });

  it('settles before the intro, but the picture question after the hop does not wait again', async () => {
    const root = document.createElement('div');
    const gate = deferred();
    const wait = vi.fn(() => gate.promise);
    const player = fakePlayer();
    runBlend(root, task, { player, wait, settleMs: 600 });
    await flush();
    expect(player.play).not.toHaveBeenCalled();
    gate.resolve();
    await flush();
    for (const i of [0, 1, 2]) { tile(root, i).click(); await flush(); }
    root.querySelector('.hop').click();
    await flush();
    expect(wait).toHaveBeenCalledOnce();
    expect(root.querySelector('.pick-one').dataset.ready).toBe('true');
  });
});


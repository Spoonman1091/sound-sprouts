import { describe, it, expect, vi } from 'vitest';
import { runPickOne } from '../../src/activities/pick-one.js';
import { prompt } from '../../src/audio/clips.js';
import { fakePlayer, flush, deferred } from '../helpers.js';

const task = {
  prompt: ['p1.mp3', 'p2.mp3'],
  cheer: 'cheer.mp3',
  choices: [
    { id: 'sun', label: 'sun', img: 'assets/img/sun.svg', audio: 'sun.mp3', correct: true },
    { id: 'pig', label: 'pig', img: 'assets/img/pig.svg', audio: 'pig.mp3', correct: false },
  ],
};
const choice = (root, id) => root.querySelector(`[data-choice-id="${id}"]`);

describe('runPickOne', () => {
  it('renders choices and plays the prompt', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    runPickOne(root, task, { player });
    expect(root.querySelectorAll('.choice')).toHaveLength(2);
    expect(choice(root, 'sun').dataset.correct).toBe('true');
    await flush();
    expect(player.playSequence).toHaveBeenCalledWith(['p1.mp3', 'p2.mp3']);
  });

  it('ignores taps while the prompt is playing', async () => {
    const root = document.createElement('div');
    const gate = deferred();
    const player = fakePlayer({ playSequence: vi.fn(() => gate.promise) });
    const done = vi.fn();
    runPickOne(root, task, { player }).then(done);
    expect(root.querySelector('.activity').dataset.ready).toBe('false');
    choice(root, 'pig').click();
    choice(root, 'sun').click();
    await flush();
    expect(done).not.toHaveBeenCalled();
    expect(choice(root, 'pig').classList.contains('wrong')).toBe(false);
    gate.resolve({ ok: true });
    await flush();
    expect(root.querySelector('.activity').dataset.ready).toBe('true');
  });

  it('resolves firstTry=true on an immediate correct answer and plays the cheer', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runPickOne(root, task, { player });
    await flush();
    choice(root, 'sun').click();
    await expect(result).resolves.toEqual({ firstTry: true });
    expect(player.play).toHaveBeenCalledWith('cheer.mp3');
  });

  it('after a wrong answer: greys it, names it, says try again, re-asks, and scores firstTry=false', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const result = runPickOne(root, task, { player });
    await flush();
    choice(root, 'pig').click();
    await flush();
    expect(choice(root, 'pig').disabled).toBe(true);
    expect(choice(root, 'pig').classList.contains('wrong')).toBe(true);
    expect(player.play).toHaveBeenCalledWith('pig.mp3');
    expect(player.play).toHaveBeenCalledWith(prompt('try_again'));
    expect(player.playSequence).toHaveBeenCalledTimes(2);
    choice(root, 'sun').click();
    await expect(result).resolves.toEqual({ firstTry: false });
  });

  it('a double tap on the right answer resolves once and plays one cheer', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const done = vi.fn();
    runPickOne(root, task, { player }).then(done);
    await flush();
    choice(root, 'sun').click();
    choice(root, 'sun').click();
    await flush();
    expect(done).toHaveBeenCalledOnce();
    expect(player.play.mock.calls.filter(([src]) => src === 'cheer.mp3')).toHaveLength(1);
  });

  it('still becomes tappable when prompt audio fails', async () => {
    const root = document.createElement('div');
    const player = fakePlayer({ playSequence: vi.fn(async () => ({ ok: false })) });
    const result = runPickOne(root, task, { player });
    await flush();
    choice(root, 'sun').click();
    await expect(result).resolves.toEqual({ firstTry: true });
  });

  it('replay re-plays the prompt only when ready', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    runPickOne(root, { ...task, focusImg: 'assets/img/cat.svg' }, { player });
    await flush();
    expect(root.querySelector('.focus')).not.toBeNull();
    root.querySelector('.replay').click();
    await flush();
    expect(player.playSequence).toHaveBeenCalledTimes(2);
  });

  it('shows letters as text when choices have no image', async () => {
    const root = document.createElement('div');
    const letters = { ...task, choices: [{ id: 's', label: 's', audio: 's.mp3', correct: true }] };
    runPickOne(root, letters, { player: fakePlayer() });
    expect(root.querySelector('.choice .letter').textContent).toBe('s');
  });

  it('waits settleMs before the first prompt and ignores taps meanwhile', async () => {
    const root = document.createElement('div');
    const gate = deferred();
    const wait = vi.fn(() => gate.promise);
    const player = fakePlayer();
    runPickOne(root, task, { player, wait, settleMs: 600 });
    expect(wait).toHaveBeenCalledWith(600);
    choice(root, 'sun').click();
    await flush();
    expect(player.playSequence).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    gate.resolve();
    await flush();
    expect(player.playSequence).toHaveBeenCalledOnce();
  });
});


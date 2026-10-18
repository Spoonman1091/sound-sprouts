import { describe, it, expect, vi } from 'vitest';
import { runIntro } from '../../src/activities/intro.js';
import { prompt, phoneme, word, letterName } from '../../src/audio/clips.js';
import { CONFIG } from '../../src/config.js';
import { createTrace } from '../../src/intro/tracer.js';
import { fakePlayer, flush, deferred } from '../helpers.js';

const box = [[[0, 0], [100, 0]]];
const task = {
  activity: 'intro',
  sound: 's',
  names: [letterName('s')],
  soundClip: phoneme('s'),
  examples: [{ id: 'sun', img: 'assets/img/sun.svg', audio: word('sun') }],
  strokes: { strokes: box, width: 100, height: 10 },
  cheer: 'cheer.mp3',
};

// Every clip the player was asked to play, in order.
const heard = (player) => [...player.playSequence.mock.calls.flat(2), ...player.play.mock.calls.flat()];
const clipLog = () => {
  const log = [];
  const player = fakePlayer({
    play: vi.fn(async (clip) => { log.push(clip); return { ok: true }; }),
    playSequence: vi.fn(async (clips) => { log.push(...clips); return { ok: true }; }),
  });
  return { log, player };
};
const never = () => new Promise(() => {});
const pointer = (target, type, [x, y], pointerId = 1) => {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
};
const trace = (root, points, pointerId = 1) => {
  const svg = root.querySelector('svg.trace');
  pointer(svg, 'pointerdown', points[0], pointerId);
  points.forEach((p) => pointer(svg, 'pointermove', p, pointerId));
  pointer(svg, 'pointerup', points[points.length - 1], pointerId);
};
const inked = (root) => root.querySelectorAll('.ink circle').length;
const noHelp = (ms) => (ms === CONFIG.TRACE_HELP_MS ? never() : Promise.resolve());
const along = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => [x, 0]);

describe('runIntro', () => {
  it('meets the letter: names it, says its sound, then shows each example picture with its word', async () => {
    const root = document.createElement('div');
    const { log, player } = clipLog();
    runIntro(root, task, { player, wait: async () => {} });
    await flush();
    expect(root.querySelector('.intro-letter').textContent).toBe('s');
    expect(log.slice(0, 6)).toEqual([
      prompt('this_is'), letterName('s'), prompt('it_says'), phoneme('s'), phoneme('s'), word('sun'),
    ]);
  });

  it('then asks her to trace, and waits until the letter is traced', async () => {
    const root = document.createElement('div');
    const { log, player } = clipLog();
    const done = vi.fn();
    runIntro(root, task, { player, wait: (ms) => (ms === CONFIG.TRACE_HELP_MS ? never() : Promise.resolve()) }).then(done);
    await flush();
    expect(root.querySelector('.intro').dataset.step).toBe('trace');
    expect(log).toContain(prompt('trace_it'));
    await flush();
    expect(done).not.toHaveBeenCalled();
    trace(root, along);
    await flush();
    expect(root.querySelector('.intro').dataset.step).toBe('say');
    await flush();
    expect(done).toHaveBeenCalledWith({ introduced: true });
  });

  it('first shows how: says "Watch me", then a finger draws each stroke in order before she traces', async () => {
    const root = document.createElement('div');
    const { log, player } = clipLog();
    const twoStrokes = { ...task, strokes: { strokes: [[[0, 0], [0, 60]], [[-20, 30], [20, 30]]], width: 40, height: 60 } };
    const steps = [];
    const wait = (ms) => {
      const demo = root.querySelector('.demo');
      if (ms === CONFIG.DEMO_STEP_MS) steps.push([...demo.querySelectorAll('polyline')].map((l) => l.getAttribute('points').split(' ').length));
      return ms === CONFIG.TRACE_HELP_MS ? never() : Promise.resolve();
    };
    runIntro(root, twoStrokes, { player, wait });
    await flush();
    expect(log.indexOf(prompt('watch_me'))).toBeGreaterThan(-1);
    expect(log.indexOf(prompt('watch_me'))).toBeLessThan(log.indexOf(prompt('trace_it')));
    const first = createTrace([twoStrokes.strokes.strokes[0]]).checkpoints.length;
    const second = createTrace([twoStrokes.strokes.strokes[1]]).checkpoints.length;
    expect(steps).toHaveLength(first + second);
    expect(steps[first - 1]).toEqual([first]);
    expect(steps[first + second - 1]).toEqual([first, second]);
    expect(root.querySelector('.demo')).toBeNull();
  });

  it('ignores her finger while the demonstration is drawing', async () => {
    const root = document.createElement('div');
    const step = deferred();
    runIntro(root, task, { player: fakePlayer(), wait: (ms) => (ms === CONFIG.DEMO_STEP_MS ? step.promise : noHelp(ms)) });
    await flush();
    expect(root.querySelector('.demo .pen')).not.toBeNull();
    expect(root.querySelector('svg.trace').dataset.ready).toBeUndefined();
    trace(root, along);
    expect(inked(root)).toBe(0);
  });

  it('fills in the letter as she traces, even while "Trace it!" is still playing', async () => {
    const root = document.createElement('div');
    const instruction = deferred();
    const player = fakePlayer({
      playSequence: vi.fn((clips) => (clips[0] === prompt('trace_it') ? instruction.promise : Promise.resolve({ ok: true }))),
    });
    runIntro(root, task, { player, wait: noHelp });
    await flush();
    expect(root.querySelector('svg.trace').dataset.ready).toBe('true');
    trace(root, along.slice(0, 4));
    expect(inked(root)).toBeGreaterThan(0);
    expect(root.querySelector('.intro').dataset.step).toBe('trace');
  });

  it('keeps inking when a resting palm or second finger lifts, and stops when the system cancels the touch', async () => {
    const root = document.createElement('div');
    runIntro(root, task, { player: fakePlayer(), wait: noHelp });
    await flush();
    const svg = root.querySelector('svg.trace');
    pointer(svg, 'pointerdown', [0, 0], 1);
    pointer(svg, 'pointerdown', [100, 90], 2);
    pointer(svg, 'pointerup', [100, 90], 2);
    pointer(svg, 'pointermove', [30, 0], 1);
    const afterPalm = inked(root);
    expect(afterPalm).toBeGreaterThan(3);
    pointer(svg, 'pointermove', [60, 0], 2);
    pointer(svg, 'pointercancel', [30, 0], 1);
    pointer(svg, 'pointermove', [60, 0], 1);
    expect(inked(root)).toBe(afterPalm);
  });

  it('counts a quick swipe everywhere the finger passed, not just where the screen noticed it', async () => {
    const root = document.createElement('div');
    const done = vi.fn();
    runIntro(root, task, { player: fakePlayer(), wait: noHelp }).then(done);
    await flush();
    trace(root, [[0, 0], [50, 0], [100, 0]]);
    await flush();
    await flush();
    expect(root.querySelector('.intro').dataset.step).toBe('say');
  });

  it('starts a stroke that begins on the card around the letter', async () => {
    const root = document.createElement('div');
    runIntro(root, task, { player: fakePlayer(), wait: noHelp });
    await flush();
    pointer(root.querySelector('.intro-trace'), 'pointerdown', [-40, 0]);
    pointer(root.querySelector('svg.trace'), 'pointermove', [0, 0]);
    expect(inked(root)).toBeGreaterThan(0);
  });

  it('celebrates a finished trace with the sound and a cheer, then asks her to say it', async () => {
    const root = document.createElement('div');
    const { log, player } = clipLog();
    runIntro(root, task, { player, wait: (ms) => (ms === CONFIG.TRACE_HELP_MS ? never() : Promise.resolve()) });
    await flush();
    log.length = 0;
    trace(root, along);
    await flush();
    await flush();
    expect(log).toEqual([phoneme('s'), 'cheer.mp3', prompt('your_turn'), phoneme('s')]);
  });

  it('offers a big arrow to move on if tracing takes too long', async () => {
    const root = document.createElement('div');
    const help = deferred();
    const done = vi.fn();
    runIntro(root, task, { player: fakePlayer(), wait: (ms) => (ms === CONFIG.TRACE_HELP_MS ? help.promise : Promise.resolve()) }).then(done);
    await flush();
    const next = root.querySelector('.intro-next');
    expect(next.hidden).toBe(true);
    help.resolve();
    await flush();
    expect(next.hidden).toBe(false);
    next.click();
    await flush();
    await flush();
    expect(done).toHaveBeenCalledWith({ introduced: true });
  });

  it('exposes the guide checkpoints so the letter can be traced in end-to-end tests', async () => {
    const root = document.createElement('div');
    runIntro(root, task, { player: fakePlayer(), wait: never });
    const svg = root.querySelector('svg.trace');
    expect(JSON.parse(svg.dataset.checkpoints)).toEqual(createTrace(box).checkpoints);
  });

  it('fits the tracing area to the letter, so short letters are drawn big', async () => {
    const root = document.createElement('div');
    const shortLetter = { ...task, strokes: { strokes: [[[10, 50], [50, 100]]], width: 60, height: 145 } };
    runIntro(root, shortLetter, { player: fakePlayer(), wait: never });
    const [x, y, w, h] = root.querySelector('svg.trace').getAttribute('viewBox').split(' ').map(Number);
    expect(x).toBeLessThan(10);
    expect(y).toBeLessThan(50);
    expect(y).toBeGreaterThan(20);
    expect(x + w).toBeGreaterThan(50);
    expect(y + h).toBeGreaterThan(100);
    expect(y + h).toBeLessThan(130);
  });

  it('points an arrow along each stroke, just after its start dot', async () => {
    const root = document.createElement('div');
    const two = { ...task, strokes: { strokes: [[[0, 0], [100, 0]], [[0, 50], [0, 100]]], width: 100, height: 100 } };
    runIntro(root, two, { player: fakePlayer(), wait: never });
    const arrows = [...root.querySelectorAll('svg.trace .arrow')];
    expect(arrows).toHaveLength(2);
    expect(arrows[0].getAttribute('transform')).toMatch(/rotate\(0\)/);
    expect(arrows[1].getAttribute('transform')).toMatch(/rotate\(90\)/);
  });
});


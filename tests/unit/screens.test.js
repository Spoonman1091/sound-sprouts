import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgress } from '../../src/state/progress.js';
import { renderGarden } from '../../src/screens/garden.js';
import { renderHome } from '../../src/screens/home.js';
import { renderDone, newlyBloomed } from '../../src/screens/done.js';
import { prompt } from '../../src/audio/clips.js';
import { CONFIG } from '../../src/config.js';
import { fakePlayer, withMastered, deferred, flush } from '../helpers.js';

describe('renderGarden', () => {
  it('draws one plot per letter with its status', () => {
    const garden = renderGarden(withMastered(undefined, ['ls:s']), { bloomed: ['s'] });
    const plots = [...garden.querySelectorAll('.plot')];
    expect(plots.map((p) => p.dataset.letter)).toEqual(['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o']);
    expect(plots.map((p) => p.dataset.status)).toEqual(['flower', 'sprout', ...Array(8).fill('seed')]);
    expect(plots[0].classList.contains('bloom')).toBe(true);
    expect(plots[2].querySelector('.seed')).not.toBeNull();
  });
});

describe('renderHome', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('Play triggers onPlay once; holding the gear triggers onParent', () => {
    const root = document.createElement('div');
    const onPlay = vi.fn();
    const onParent = vi.fn();
    renderHome(root, { progress: createProgress(), onPlay, onParent });
    const play = root.querySelector('.play');
    play.click();
    play.click();
    expect(onPlay).toHaveBeenCalledOnce();
    root.querySelector('.parent-gear').dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(CONFIG.PARENT_HOLD_MS);
    expect(onParent).toHaveBeenCalledOnce();
  });
});

describe('done screen', () => {
  it('newlyBloomed lists letters mastered during the session', () => {
    expect(newlyBloomed(createProgress(), withMastered(undefined, ['ls:s', 'fs:s']))).toEqual(['s']);
  });

  it('celebrates new flowers and returns home on tap', async () => {
    const root = document.createElement('div');
    const player = fakePlayer();
    const onHome = vi.fn();
    await renderDone(root, { before: createProgress(), after: withMastered(undefined, ['ls:s']), player, onHome });
    expect(player.playSequence).toHaveBeenCalledWith([prompt('new_flower'), prompt('all_done')]);
    expect(root.querySelector('.plot.bloom')).not.toBeNull();
    root.querySelector('.home-button').click();
    expect(player.stop).toHaveBeenCalled();
    expect(onHome).toHaveBeenCalledOnce();
  });

  it('settles before celebrating', async () => {
    const gate = deferred();
    const player = fakePlayer();
    const wait = vi.fn(() => gate.promise);
    const done = renderDone(document.createElement('div'), { before: createProgress(), after: createProgress(), player, onHome: vi.fn(), wait, settleMs: 600 });
    await flush();
    expect(wait).toHaveBeenCalledWith(600);
    expect(player.playSequence).not.toHaveBeenCalled();
    gate.resolve();
    await done;
    expect(player.playSequence).toHaveBeenCalledOnce();
  });

  it('just says all done when nothing bloomed', async () => {
    const player = fakePlayer();
    await renderDone(document.createElement('div'), { before: createProgress(), after: createProgress(), player, onHome: vi.fn() });
    expect(player.playSequence).toHaveBeenCalledWith([prompt('all_done')]);
  });
});

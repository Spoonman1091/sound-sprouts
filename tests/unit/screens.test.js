import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgress } from '../../src/state/progress.js';
import { renderGarden } from '../../src/screens/garden.js';
import { renderHome } from '../../src/screens/home.js';
import { renderDone, newlyBloomed } from '../../src/screens/done.js';
import { runMeet } from '../../src/screens/meet.js';
import { prompt } from '../../src/audio/clips.js';
import { CONFIG } from '../../src/config.js';
import { LETTER_ORDER } from '../../src/curriculum/units.js';
import { fakePlayer, withMastered, deferred, flush } from '../helpers.js';

describe('renderGarden', () => {
  const SINGLE = LETTER_ORDER.filter((l) => l.length === 1);
  const MULTI = LETTER_ORDER.filter((l) => l.length > 1);
  const shownLetters = (garden) => [...garden.querySelectorAll('.plot')].map((p) => p.dataset.letter);

  it('draws one plot per single letter on the first page, with its status', () => {
    const garden = renderGarden(withMastered(undefined, ['ls:s']), { bloomed: ['s'] });
    const plots = [...garden.querySelectorAll('.plot')];
    expect(plots.map((p) => p.dataset.letter)).toEqual(SINGLE);
    expect(plots.map((p) => p.dataset.status)).toEqual(['flower', 'sprout', ...Array(SINGLE.length - 2).fill('seed')]);
    expect(plots[0].classList.contains('bloom')).toBe(true);
    expect(plots[2].querySelector('.seed')).not.toBeNull();
  });

  it('lets her tap an open plot to meet its letter again, but not a seed', () => {
    const onMeet = vi.fn();
    const garden = renderGarden(withMastered(undefined, ['ls:s']), { onMeet });
    const plots = [...garden.querySelectorAll('.plot')];
    expect(plots[0].tagName).toBe('BUTTON');
    expect(plots[0].getAttribute('aria-label')).toBe('Meet s');
    expect(plots[1].tagName).toBe('BUTTON');
    expect(plots[2].tagName).toBe('DIV');
    plots[1].click();
    expect(onMeet).toHaveBeenCalledWith('a');
  });

  it('turns to a second page of letter teams (sh, ee, ...) and back', () => {
    const garden = renderGarden(createProgress());
    expect(garden.querySelector('.garden-page-prev').hidden).toBe(true);
    garden.querySelector('.garden-page-next').click();
    expect(shownLetters(garden)).toEqual(MULTI);
    expect(garden.querySelector('.garden-page-next').hidden).toBe(true);
    expect(garden.querySelector('.garden-dots .current').dataset.page).toBe('1');
    garden.querySelector('.garden-page-prev').click();
    expect(shownLetters(garden)).toEqual(SINGLE);
  });

  it('opens on the letter teams page once she has reached them', () => {
    const allSingles = withMastered(undefined, SINGLE.map((l) => `ls:${l}`));
    expect(shownLetters(renderGarden(allSingles))).toEqual(MULTI);
  });

  it('opens on the page of a letter that just bloomed', () => {
    const allSingles = withMastered(undefined, SINGLE.map((l) => `ls:${l}`));
    expect(shownLetters(renderGarden(allSingles, { bloomed: ['q'] }))).toEqual(SINGLE);
  });

  it('is not tappable when no one is listening, e.g. on the done screen', () => {
    const garden = renderGarden(createProgress());
    expect(garden.querySelector('button.plot')).toBeNull();
  });
});

describe('runMeet', () => {
  it('runs the introduction for one sound and returns progress that remembers it', async () => {
    const container = document.createElement('div');
    const intro = vi.fn(async (stage, task) => {
      expect(stage.classList.contains('stage')).toBe(true);
      expect(task).toMatchObject({ activity: 'intro', sound: 'sh' });
      return { introduced: true };
    });
    const after = await runMeet({ container, sound: 'sh', progress: createProgress(), deps: { player: fakePlayer(), activities: { intro } } });
    expect(intro).toHaveBeenCalledOnce();
    expect(after.introduced).toEqual(['sh']);
  });
});

describe('renderHome', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('Play triggers onPlay once; holding the gear triggers onParent', () => {
    const root = document.createElement('div');
    const onPlay = vi.fn();
    const onParent = vi.fn();
    const onMeet = vi.fn();
    renderHome(root, { progress: createProgress(), onPlay, onParent, onMeet });
    root.querySelector('.plot[data-letter="a"]').click();
    expect(onMeet).toHaveBeenCalledWith('a');
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

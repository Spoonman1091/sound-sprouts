import { describe, it, expect, vi } from 'vitest';
import { createProgress } from '../../src/state/progress.js';
import { renderDashboard } from '../../src/parent/dashboard.js';
import { withMastered } from '../helpers.js';

const baseState = { progress: createProgress(), storageStatus: 'loaded', audioErrors: [] };
const render = (overrides = {}, handlers = {}) => {
  const root = document.createElement('div');
  const h = { onSaveName: vi.fn(), onReset: vi.fn(), onPrint: vi.fn(), onDone: vi.fn(), onDismissNotice: vi.fn(), confirmFn: vi.fn(() => true), ...handlers };
  renderDashboard(root, { state: { ...baseState, ...overrides }, now: () => 0, ...h });
  return { root, h };
};
const button = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text);

describe('renderDashboard', () => {
  it('shows a row per letter with status', () => {
    const { root } = render({ progress: withMastered(undefined, ['ls:s']) });
    const rows = [...root.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toContain('Mastered');
    expect(rows[1]).toContain('Learning');
    expect(rows[2]).toContain('Not started');
  });

  it('validates the name before saving', () => {
    const { root, h } = render();
    const input = root.querySelector('#child-name');
    input.value = 'Ava2';
    button(root, 'Save name').click();
    expect(h.onSaveName).not.toHaveBeenCalled();
    expect(root.querySelector('.error').textContent).toMatch(/letters/);
    input.value = '  Ava ';
    button(root, 'Save name').click();
    expect(h.onSaveName).toHaveBeenCalledWith('Ava');
  });

  it('only resets after confirmation', () => {
    const declined = render({}, { confirmFn: vi.fn(() => false) });
    button(declined.root, 'Reset progress').click();
    expect(declined.h.onReset).not.toHaveBeenCalled();
    const accepted = render();
    button(accepted.root, 'Reset progress').click();
    expect(accepted.h.onReset).toHaveBeenCalledOnce();
  });

  it.each([
    ['reset', /started fresh/],
    ['unavailable', /can't save/],
  ])('explains storage status %s', (storageStatus, text) => {
    expect(render({ storageStatus }).root.querySelector('.notice').textContent).toMatch(text);
  });

  it('lets the parent dismiss the started-fresh notice', () => {
    const { root, h } = render({ storageStatus: 'reset' });
    button(root, 'Dismiss').click();
    expect(h.onDismissNotice).toHaveBeenCalledOnce();
    expect(button(render({ storageStatus: 'unavailable' }).root, 'Dismiss')).toBeUndefined();
  });

  it('warns about sounds that failed to play', () => {
    const { root } = render({ audioErrors: ['assets/audio/word/sun.mp3'] });
    expect(root.textContent).toMatch(/1 sound/);
  });

  it('wires print and done', () => {
    const { root, h } = render();
    button(root, 'Print a mini-book').click();
    button(root, 'Back to the garden').click();
    expect(h.onPrint).toHaveBeenCalledOnce();
    expect(h.onDone).toHaveBeenCalledOnce();
  });
});

import { describe, it, expect } from 'vitest';
import { createProgress } from '../../src/state/progress.js';
import { minibookWords, renderMinibook } from '../../src/parent/minibook.js';
import { withMastered } from '../helpers.js';

describe('minibook', () => {
  it('uses blend words made only of mastered letters', () => {
    expect(minibookWords(withMastered(undefined, ['ls:s', 'ls:i', 'ls:p']))).toEqual(['sip']);
  });

  it('leaves longer words out until they are ready to practise', () => {
    expect(minibookWords(withMastered(undefined, ['ls:s', 'ls:t', 'ls:o', 'ls:p']))).not.toContain('stop');
  });

  it('counts a digraph as one sound', () => {
    expect(minibookWords(withMastered(undefined, ['ls:f', 'ls:i', 'ls:sh']))).toEqual(['fish']);
  });

  it('renders word pages, or letter pages when no words are ready', () => {
    const target = document.createElement('div');
    expect(renderMinibook(target, withMastered(undefined, ['ls:s', 'ls:i', 'ls:p']))).toBe(1);
    expect(target.querySelector('.mb-word').textContent).toBe('sip');
    expect(renderMinibook(target, createProgress())).toBe(2);
    expect([...target.querySelectorAll('.mb-letter')].map((n) => n.textContent)).toEqual(['s', 'a']);
  });
});

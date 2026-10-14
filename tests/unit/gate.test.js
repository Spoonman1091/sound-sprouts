import { describe, it, expect, vi } from 'vitest';
import { makeQuestion, renderGate } from '../../src/parent/gate.js';
import { seededRng } from '../helpers.js';

describe('parent gate', () => {
  it.each([1, 2, 3, 4, 5])('makeQuestion (seed %i) has 4 distinct options including the answer', (seed) => {
    const q = makeQuestion(seededRng(seed));
    const [a, b] = q.text.split(' + ').map(Number);
    expect(q.answer).toBe(a + b);
    expect(new Set(q.options).size).toBe(4);
    expect(q.options).toContain(q.answer);
  });

  it('passes on the right answer and cancels on a wrong one', () => {
    const rng = seededRng(1);
    const q = makeQuestion(seededRng(1));
    const root = document.createElement('div');
    const onPass = vi.fn();
    const onCancel = vi.fn();
    renderGate(root, { rng, onPass, onCancel });
    expect(root.querySelector('.gate p').textContent).toBe(`What is ${q.text}?`);
    const buttons = [...root.querySelectorAll('.gate-option')];
    buttons.find((b) => Number(b.textContent) !== q.answer).click();
    expect(onCancel).toHaveBeenCalledOnce();
    buttons.find((b) => Number(b.textContent) === q.answer).click();
    expect(onPass).toHaveBeenCalledOnce();
  });
});

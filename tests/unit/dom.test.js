import { describe, it, expect, vi } from 'vitest';
import { el } from '../../src/ui/dom.js';

describe('el', () => {
  it('creates an element with class, attributes, dataset and children', () => {
    const node = el('button', { class: 'choice', 'aria-label': 'sun', dataset: { choiceId: 'sun' } }, ['hi', el('span')]);
    expect(node.tagName).toBe('BUTTON');
    expect(node.className).toBe('choice');
    expect(node.getAttribute('aria-label')).toBe('sun');
    expect(node.dataset.choiceId).toBe('sun');
    expect(node.textContent).toBe('hi');
    expect(node.querySelector('span')).not.toBeNull();
  });

  it('wires on* props as event listeners', () => {
    const onClick = vi.fn();
    el('button', { onClick }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('skips null and undefined children', () => {
    expect(el('div', {}, [null, 'a', undefined]).textContent).toBe('a');
  });
});

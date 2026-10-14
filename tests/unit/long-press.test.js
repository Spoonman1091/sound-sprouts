import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onLongPress } from '../../src/ui/long-press.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('onLongPress', () => {
  it('fires after holding for the full duration', () => {
    const target = document.createElement('button');
    const cb = vi.fn();
    onLongPress(target, 2000, cb);
    target.dispatchEvent(new Event('pointerdown'));
    expect(target.classList.contains('holding')).toBe(true);
    vi.advanceTimersByTime(1999);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledOnce();
  });

  it.each(['pointerup', 'pointerleave', 'pointercancel'])('cancels on %s', (type) => {
    const target = document.createElement('button');
    const cb = vi.fn();
    onLongPress(target, 2000, cb);
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event(type));
    vi.advanceTimersByTime(3000);
    expect(cb).not.toHaveBeenCalled();
    expect(target.classList.contains('holding')).toBe(false);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { stopWhenHidden } from '../../src/audio/visibility.js';

describe('stopWhenHidden', () => {
  it('suspends audio while hidden and resumes when visible again', () => {
    const player = { suspend: vi.fn(), resume: vi.fn() };
    stopWhenHidden(document, player);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.suspend).toHaveBeenCalledOnce();
    expect(player.resume).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.resume).toHaveBeenCalledOnce();
  });
});

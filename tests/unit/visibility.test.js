import { describe, it, expect } from 'vitest';
import { stopWhenHidden } from '../../src/audio/visibility.js';
import { fakePlayer } from '../helpers.js';

describe('stopWhenHidden', () => {
  it('stops audio when the document becomes hidden', () => {
    const player = fakePlayer();
    stopWhenHidden(document, player);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.stop).toHaveBeenCalledOnce();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(player.stop).toHaveBeenCalledOnce();
  });
});

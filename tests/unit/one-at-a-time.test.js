import { describe, it, expect, vi } from 'vitest';
import { oneAtATime } from '../../src/ui/one-at-a-time.js';
import { deferred, flush } from '../helpers.js';

describe('oneAtATime', () => {
  it('ignores other taps while one action is still running, e.g. Play then a garden plot', async () => {
    const gate = deferred();
    const play = vi.fn(() => gate.promise);
    const meet = vi.fn(async () => {});
    const guard = oneAtATime();
    guard(play)();
    guard(meet)('s');
    guard(play)();
    expect(play).toHaveBeenCalledOnce();
    expect(meet).not.toHaveBeenCalled();
    gate.resolve();
    await flush();
    guard(meet)('s');
    expect(meet).toHaveBeenCalledWith('s');
  });

  it('frees up again even if the action fails', async () => {
    const guard = oneAtATime();
    await guard(async () => { throw new Error('boom'); })().catch(() => {});
    const next = vi.fn(async () => {});
    guard(next)();
    expect(next).toHaveBeenCalledOnce();
  });
});

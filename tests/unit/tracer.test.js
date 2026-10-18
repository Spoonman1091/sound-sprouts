import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../src/config.js';
import { createTrace, traceTo } from '../../src/intro/tracer.js';

const line = [[[0, 0], [100, 0]]];

describe('tracer', () => {
  it('spreads checkpoints evenly along every stroke', () => {
    const trace = createTrace(line, 10);
    expect(trace.checkpoints).toHaveLength(11);
    expect(trace.checkpoints[5]).toEqual([50, 0]);
    expect(trace.coverage).toBe(0);
  });

  it('covers checkpoints near the finger, without changing the earlier trace', () => {
    const start = createTrace(line, 10);
    const next = traceTo(start, [50, 3]);
    expect(start.coverage).toBe(0);
    expect(next.covered[5]).toBe(true);
    expect(next.coverage).toBeGreaterThan(0);
  });

  it('is forgiving: wobbles within the tolerance still count, far-off touches do not', () => {
    const t = createTrace(line, 10);
    expect(traceTo(t, [50, CONFIG.TRACE_TOLERANCE - 1]).covered[5]).toBe(true);
    expect(traceTo(t, [50, CONFIG.TRACE_TOLERANCE + 30]).coverage).toBe(0);
  });

  it('does not care about direction or order', () => {
    const backwards = [100, 80, 60, 40, 20, 0].reduce((t, x) => traceTo(t, [x, 0]), createTrace(line, 10));
    expect(backwards.done).toBe(true);
  });

  it('is done once most of the letter is covered', () => {
    const t = [0, 10, 20, 30, 40, 50, 60, 70, 80].reduce((acc, x) => traceTo(acc, [x, 0]), createTrace(line, 10));
    expect(CONFIG.TRACE_DONE_COVERAGE).toBeLessThan(1);
    expect(t.done).toBe(t.coverage >= CONFIG.TRACE_DONE_COVERAGE);
    expect(traceTo(createTrace(line, 10), [0, 0]).done).toBe(false);
  });
});

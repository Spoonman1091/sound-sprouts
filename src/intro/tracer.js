import { CONFIG } from '../config.js';

const distance = ([x1, y1], [x2, y2]) => Math.hypot(x2 - x1, y2 - y1);

// Points every `spacing` units along a stroke, including both ends.
function resample(stroke, spacing) {
  const lengths = stroke.slice(1).map((point, i) => distance(stroke[i], point));
  const total = lengths.reduce((sum, d) => sum + d, 0);
  const count = Math.max(1, Math.round(total / spacing));
  return Array.from({ length: count + 1 }, (_, i) => {
    let along = (total * i) / count;
    const segment = lengths.findIndex((d) => {
      if (along <= d) return true;
      along -= d;
      return false;
    });
    const at = segment === -1 ? lengths.length - 1 : segment;
    const [[x1, y1], [x2, y2]] = [stroke[at], stroke[at + 1]];
    const t = lengths[at] === 0 ? 0 : Math.min(1, along / lengths[at]);
    return [Math.round((x1 + (x2 - x1) * t) * 10) / 10, Math.round((y1 + (y2 - y1) * t) * 10) / 10];
  });
}

// Forgiving tracing: any part of the letter can be traced in any order, and the finger only has to
// pass within TRACE_TOLERANCE of the guide. The letter is done once most of it is covered.
export function createTrace(strokes, spacing = CONFIG.TRACE_SPACING) {
  const checkpoints = strokes.flatMap((stroke) => resample(stroke, spacing));
  return { checkpoints, covered: checkpoints.map(() => false), coverage: 0, done: false };
}

export function traceTo(trace, point) {
  const covered = trace.checkpoints.map((c, i) => trace.covered[i] || distance(c, point) <= CONFIG.TRACE_TOLERANCE);
  const coverage = covered.filter(Boolean).length / covered.length;
  return { ...trace, covered, coverage, done: coverage >= CONFIG.TRACE_DONE_COVERAGE };
}

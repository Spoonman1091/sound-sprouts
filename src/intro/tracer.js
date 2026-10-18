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
// pass within TRACE_TOLERANCE of the guide. Each touch counts only toward the stroke the finger is on
// (the nearest one), and only where the finger actually is along it, so going round the "a" does not
// draw its whole stick, and the downstroke of a "t" does not cross it. The letter is done once most
// of every stroke has been traced.
export function createTrace(strokes, spacing = CONFIG.TRACE_SPACING) {
  const perStroke = strokes.map((stroke) => resample(stroke, spacing));
  const checkpoints = perStroke.flat();
  return {
    checkpoints,
    strokeOf: perStroke.flatMap((points, s) => points.map(() => s)),
    spacing,
    covered: checkpoints.map(() => false),
    credited: checkpoints.map(() => false),
    coverage: 0,
    done: false,
  };
}

function strokeDistances({ checkpoints, strokeOf }, point) {
  return checkpoints.reduce((nearest, c, i) => {
    const s = strokeOf[i];
    return { ...nearest, [s]: Math.min(nearest[s] ?? Infinity, distance(c, point)) };
  }, {});
}

function everyStrokeTraced({ strokeOf }, credited) {
  return [...new Set(strokeOf)].every((s) => {
    const mine = credited.filter((_, i) => strokeOf[i] === s);
    return mine.filter(Boolean).length / mine.length >= CONFIG.TRACE_DONE_COVERAGE;
  });
}

export function traceTo(trace, point) {
  const near = (c) => distance(c, point) <= CONFIG.TRACE_TOLERANCE;
  const toStroke = strokeDistances(trace, point);
  const nearestStroke = Math.min(...Object.values(toStroke));
  // Checkpoints are only `spacing` apart, so a finger between two of them on the nearest stroke can
  // measure up to half a spacing farther from it than from a crossing stroke.
  const onStroke = (s) => toStroke[s] <= nearestStroke + trace.spacing / 2;
  const underFinger = (c, s) => distance(c, point) <= toStroke[s] + trace.spacing;
  const credit = (c, s) => near(c) && onStroke(s) && underFinger(c, s);
  const covered = trace.checkpoints.map((c, i) => trace.covered[i] || near(c));
  const credited = trace.checkpoints.map((c, i) => trace.credited[i] || credit(c, trace.strokeOf[i]));
  const coverage = covered.filter(Boolean).length / covered.length;
  const done = coverage >= CONFIG.TRACE_DONE_COVERAGE && everyStrokeTraced(trace, credited);
  return { ...trace, covered, credited, coverage, done };
}

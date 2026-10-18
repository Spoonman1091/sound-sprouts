import { CONFIG } from '../config.js';
import { svgEl } from '../ui/svg.js';
import { createTrace } from './tracer.js';

const pointText = ([x, y]) => `${x},${y}`;

function movePen(pen, [x, y]) {
  pen.setAttribute('x', String(x));
  pen.setAttribute('y', String(y));
}

// Shows how the letter is written: a finger draws each stroke in order, from its start dot the way
// its arrow points, then the drawing clears so she can trace it herself.
export async function demonstrate(svg, strokes, wait) {
  const pen = svgEl('text', { class: 'pen', 'aria-hidden': 'true' }, ['👆']);
  const layer = svgEl('g', { class: 'demo' });
  svg.append(layer);
  for (const [s, stroke] of strokes.entries()) {
    const points = createTrace([stroke]).checkpoints;
    const line = svgEl('polyline', { points: '' });
    layer.append(line, pen);
    for (const [i, point] of points.entries()) {
      line.setAttribute('points', points.slice(0, i + 1).map(pointText).join(' '));
      movePen(pen, point);
      await wait(CONFIG.DEMO_STEP_MS);
    }
    await wait(s === strokes.length - 1 ? CONFIG.DEMO_HOLD_MS : CONFIG.DEMO_STROKE_GAP_MS);
  }
  layer.remove();
}

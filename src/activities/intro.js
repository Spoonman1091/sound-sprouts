import { el } from '../ui/dom.js';
import { prompt } from '../audio/clips.js';
import { CONFIG } from '../config.js';
import { createTrace, traceTo } from '../intro/tracer.js';
import { settle, pause } from './settle.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAD = 14;

function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  node.append(...children);
  return node;
}

const toPoints = (stroke) => stroke.map(([x, y]) => `${x},${y}`).join(' ');

const ARROW_OFFSET = 13;

// A small arrowhead just past the start dot, pointing the way the stroke goes.
function arrowFor(stroke) {
  const [x0, y0] = stroke[0];
  const [x1, y1] = stroke.find(([x, y]) => x !== x0 || y !== y0) ?? [x0 + 1, y0];
  const length = Math.hypot(x1 - x0, y1 - y0);
  const [ux, uy] = [(x1 - x0) / length, (y1 - y0) / length];
  const angle = Math.round((Math.atan2(uy, ux) * 180) / Math.PI);
  const at = [Math.round((x0 + ux * ARROW_OFFSET) * 10) / 10, Math.round((y0 + uy * ARROW_OFFSET) * 10) / 10];
  return svgEl('polygon', { class: 'arrow', points: '-4,-5 6,0 -4,5', transform: `translate(${at[0]} ${at[1]}) rotate(${angle})` });
}

// The view is cropped to the letter itself, so short letters like "s" fill the tracing card.
function viewBoxFor(strokes) {
  const xs = strokes.flat().map(([x]) => x);
  const ys = strokes.flat().map(([, y]) => y);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  return `${minX - PAD} ${minY - PAD} ${Math.max(...xs) - minX + 2 * PAD} ${Math.max(...ys) - minY + 2 * PAD}`;
}

function renderTraceArea({ strokes }, checkpoints) {
  const guides = strokes.map((stroke) => svgEl('polyline', { class: 'guide', points: toPoints(stroke) }));
  const starts = strokes.map(([[x, y]], i) => svgEl('circle', { class: i === 0 ? 'start first' : 'start', cx: x, cy: y, r: 6 }));
  const ink = svgEl('g', { class: 'ink' });
  const svg = svgEl('svg', {
    class: 'trace',
    viewBox: viewBoxFor(strokes),
    'aria-label': 'Trace the letter',
    role: 'img',
  }, [...guides, ink, ...strokes.map(arrowFor), ...starts]);
  svg.dataset.checkpoints = JSON.stringify(checkpoints);
  return { svg, ink };
}

function renderIntro(task, checkpoints) {
  const examples = task.examples.map((e) => el('img', { class: 'example', src: e.img, alt: '', dataset: { id: e.id } }));
  const area = renderTraceArea(task.strokes, checkpoints);
  const next = el('button', { class: 'intro-next', 'aria-label': 'Next', hidden: '' }, ['➜']);
  const root = el('div', { class: 'activity intro', dataset: { step: 'meet' } }, [
    el('div', { class: 'intro-meet' }, [el('p', { class: 'intro-letter' }, [task.sound]), el('div', { class: 'intro-examples' }, examples)]),
    el('div', { class: 'intro-trace' }, [area.svg, next]),
    el('div', { class: 'intro-say' }, [el('p', { class: 'intro-letter' }, [task.sound])]),
  ]);
  return { root, examples, svg: area.svg, ink: area.ink, next, area: root.querySelector('.intro-trace') };
}

// Screen position -> letter-box coordinates (jsdom has no layout, so it falls back to the raw position).
function toLetterPoint(svg, event) {
  const ctm = svg.getScreenCTM?.();
  if (!ctm) return [event.clientX, event.clientY];
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
  return [p.x, p.y];
}

// Resolves when the letter is traced (true) or she taps the arrow that appears after a while (false).
// Only the first finger down draws: a resting palm or second finger is ignored, and lifting it
// does not stop the drawing finger. Listening on the whole card lets a stroke start just off the letter.
function waitForTrace(view, start) {
  let trace = start;
  let activePointer = null;
  return new Promise((resolve) => {
    const ink = (i) => view.ink.append(svgEl('circle', { cx: trace.checkpoints[i][0], cy: trace.checkpoints[i][1], r: 7 }));
    const move = (event) => {
      if (event.pointerId !== activePointer || trace.done) return;
      const before = trace.covered;
      trace = traceTo(trace, toLetterPoint(view.svg, event));
      trace.covered.forEach((c, i) => { if (c && !before[i]) ink(i); });
      if (trace.done) { activePointer = null; resolve(true); }
    };
    const lift = (event) => { if (event.pointerId === activePointer) activePointer = null; };
    view.area.addEventListener('pointerdown', (event) => {
      if (activePointer !== null) return;
      activePointer = event.pointerId;
      try { view.area.setPointerCapture?.(event.pointerId); } catch { /* pointer already gone */ }
      move(event);
    });
    view.area.addEventListener('pointermove', move);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => view.area.addEventListener(type, lift));
    view.next.addEventListener('click', () => resolve(false), { once: true });
    view.svg.dataset.ready = 'true';
  });
}

// "Meet the letter" for a newly opened sound: see and hear it, trace it, then say it. Not scored.
export function runIntro(container, task, deps) {
  const { player, wait = pause, leadInGapMs = 0, narrateGapMs = 0 } = deps;
  const hold = (ms) => (ms > 0 ? wait(ms) : Promise.resolve());
  const view = renderIntro(task, createTrace(task.strokes.strokes).checkpoints);
  const setStep = (step) => { view.root.dataset.step = step; };
  container.replaceChildren(view.root);

  const meet = async () => {
    await player.playSequence([prompt('this_is')]);
    await hold(leadInGapMs);
    await player.playSequence(task.names);
    await hold(narrateGapMs);
    await player.playSequence([prompt('it_says')]);
    await hold(leadInGapMs);
    await player.playSequence([task.soundClip]);
    for (const [i, example] of task.examples.entries()) {
      view.examples[i].classList.add('lit');
      await player.playSequence([task.soundClip, example.audio]);
      await hold(narrateGapMs);
    }
  };

  const traceIt = async () => {
    setStep('trace');
    // Tracing works straight away, even while the instruction is still playing.
    let finished = false;
    const tracing = waitForTrace(view, createTrace(task.strokes.strokes)).then((traced) => { finished = true; return traced; });
    await player.playSequence([prompt('trace_it')]);
    wait(CONFIG.TRACE_HELP_MS).then(() => { if (!finished) view.next.hidden = false; });
    const traced = await tracing;
    if (traced) {
      view.root.classList.add('traced');
      await player.playSequence([task.soundClip]);
      await player.play(task.cheer);
    }
  };

  const sayIt = async () => {
    setStep('say');
    await player.playSequence([prompt('your_turn')]);
    await hold(leadInGapMs);
    await player.playSequence([task.soundClip]);
    await hold(CONFIG.SAY_PAUSE_MS);
  };

  return settle(deps).then(meet).then(traceIt).then(sayIt).then(() => ({ introduced: true }));
}

// Tracing guides for lowercase letters, drawn the way phonics programmes teach them to be written.
// Each letter sits in a LETTER_BOX: ascenders start near y=0, the x-height is y=50, the baseline
// y=100 and descenders reach down to y=145. A letter is a list of strokes; a stroke is a list of
// [x, y] points in writing order.

export const LETTER_BOX = Object.freeze({ width: 60, height: 145, xHeight: 50, baseline: 100, gap: 14 });

const round = (n) => Math.round(n * 10) / 10;

const line = (x1, y1, x2, y2) => [[x1, y1], [x2, y2]];

// Angles in degrees, measured clockwise from "3 o'clock" (screen coordinates, y grows downward).
// Going from a larger to a smaller angle draws anticlockwise, like the round part of "a" or "c".
function arc(cx, cy, rx, ry, from, to, step = 15) {
  const count = Math.max(1, Math.ceil(Math.abs(to - from) / step));
  return Array.from({ length: count + 1 }, (_, i) => {
    const rad = ((from + ((to - from) * i) / count) * Math.PI) / 180;
    return [round(cx + rx * Math.cos(rad)), round(cy + ry * Math.sin(rad))];
  });
}

const dot = (x, y) => line(x, y - 2, x, y + 2);
const roundBowl = (cx = 30) => arc(cx, 75, 22, 22, -30, -390);

export const STROKES = Object.freeze({
  a: [roundBowl(), line(52, 52, 52, 100)],
  b: [line(10, 0, 10, 100), arc(32, 75, 22, 22, 180, 540)],
  c: [arc(32, 75, 22, 22, -40, -320)],
  d: [roundBowl(), line(52, 0, 52, 100)],
  e: [[...line(9, 75, 52, 75), ...arc(30, 75, 22, 22, 0, -320).slice(1)]],
  f: [[...arc(42, 20, 14, 14, -20, -180), [28, 100]], line(12, 50, 46, 50)],
  g: [roundBowl(), [[52, 52], ...arc(32, 122, 20, 18, 0, 160)]],
  h: [line(10, 0, 10, 100), [...arc(30, 72, 20, 20, 180, 360), [50, 100]]],
  i: [line(30, 50, 30, 100), dot(30, 30)],
  j: [[[36, 50], ...arc(22, 125, 14, 14, 0, 160)], dot(36, 30)],
  k: [line(10, 0, 10, 100), [[48, 50], [10, 78], [48, 100]]],
  l: [line(30, 0, 30, 100)],
  m: [line(8, 50, 8, 100), [...arc(20, 66, 12, 14, 180, 360), [32, 100]], [...arc(44, 66, 12, 14, 180, 360), [56, 100]]],
  n: [line(10, 50, 10, 100), [...arc(30, 70, 20, 18, 180, 360), [50, 100]]],
  o: [arc(30, 75, 22, 22, -90, -450)],
  p: [line(10, 50, 10, 142), arc(32, 75, 22, 22, 180, 540)],
  q: [roundBowl(), line(52, 52, 52, 142)],
  r: [line(12, 50, 12, 100), arc(30, 68, 18, 16, 180, 315)],
  s: [[...arc(30, 63, 18, 12, -20, -270), ...arc(30, 87, 18, 12, -90, 160).slice(1)]],
  t: [line(26, 8, 26, 100), line(10, 50, 44, 50)],
  u: [[[10, 50], ...arc(30, 78, 20, 22, 180, 0), [50, 50]], line(50, 50, 50, 100)],
  v: [[[8, 50], [30, 100], [52, 50]]],
  w: [[[4, 50], [17, 100], [30, 62], [43, 100], [56, 50]]],
  x: [line(10, 50, 50, 100), line(50, 50, 10, 100)],
  y: [line(10, 50, 31, 98), line(52, 50, 18, 142)],
  z: [[[10, 50], [50, 50], [10, 100], [50, 100]]],
});

// Multi-letter sounds (sh, igh) are traced one letter after another, side by side.
export function strokesFor(sound) {
  const letters = [...sound];
  const step = LETTER_BOX.width + LETTER_BOX.gap;
  const strokes = letters.flatMap((letter, i) =>
    STROKES[letter].map((stroke) => stroke.map(([x, y]) => [x + i * step, y])));
  return { strokes, width: letters.length * LETTER_BOX.width + (letters.length - 1) * LETTER_BOX.gap, height: LETTER_BOX.height };
}

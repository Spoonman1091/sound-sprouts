// Letter order follows common synthetic-phonics programmes: s a t p, i n m d, g o c k, e u h r, f b.
export const LETTER_ORDER = Object.freeze(['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k', 'e', 'u', 'h', 'r', 'f', 'b']);

// c and k make the same sound: they share one recording and are never offered against each other.
const SOUND_TWINS = Object.freeze({ c: 'k', k: 'c' });
export const PHONEME_SOURCE = Object.freeze({ k: 'c' });
export const soundsAlike = (a, b) => a === b || SOUND_TWINS[a] === b;

// No reliable picturable short-/i/ word exists in OpenMoji, so 'i' has no first-sound item.
export const FIRST_SOUND_WORDS = Object.freeze({
  s: ['sun', 'sock'],
  a: ['apple', 'ant'],
  t: ['tent', 'tiger'],
  p: ['pig', 'pizza'],
  n: ['nest', 'nose'],
  m: ['moon', 'mouse'],
  d: ['dog', 'duck'],
  g: ['goat', 'gift'],
  o: ['octopus', 'otter'],
  c: ['cat', 'car'],
  k: ['kite', 'key'],
  e: ['egg', 'elephant'],
  u: ['umbrella'],
  h: ['horse', 'hat'],
  r: ['rabbit', 'rainbow'],
  f: ['fish', 'fox'],
  b: ['ball', 'bee'],
});

// First word is the target; the rest rhyme with it.
export const RHYME_SETS = Object.freeze([
  ['cat', 'hat', 'bat'],
  ['car', 'star'],
  ['bee', 'tree'],
  ['cake', 'snake'],
  ['mouse', 'house'],
  ['goat', 'boat'],
  ['fox', 'box'],
  ['frog', 'log'],
  ['moon', 'spoon'],
]);

export const BLEND_WORDS = Object.freeze(['pin', 'tap', 'pan', 'tin', 'sip', 'nap', 'dog', 'pig', 'map', 'sad', 'man',
  'cat', 'cap', 'pen', 'ten', 'sun', 'nut', 'cup',
  'hat', 'bag', 'bed', 'bus', 'bug']);

export const PICTURE_WORDS = Object.freeze([
  ...new Set([...Object.values(FIRST_SOUND_WORDS).flat(), ...RHYME_SETS.flat(), ...BLEND_WORDS]),
]);

export const CHEERS = Object.freeze(['great_job_1', 'great_job_2', 'great_job_3']);

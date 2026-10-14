// Letter order follows common synthetic-phonics programmes: s a t p, i n m d, g o c k, e u h r, f b, l j v w, x y z q,
// then the digraphs sh ch th ng ck (two letters, one sound), then the vowel teams ee oo ai, oa ar or, ur ow oi.
export const LETTER_ORDER = Object.freeze(['s', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k', 'e', 'u', 'h', 'r', 'f', 'b', 'l', 'j', 'v', 'w', 'x', 'y', 'z', 'q',
  'sh', 'ch', 'th', 'ng', 'ck', 'ee', 'oo', 'ai', 'oa', 'ar', 'or', 'ur', 'ow', 'oi']);

const DIGRAPHS = Object.freeze(LETTER_ORDER.filter((l) => l.length === 2));

// Split a word into its sounds, keeping digraphs together: 'chick' -> ['ch', 'i', 'ck'].
export function graphemes(w) {
  if (!w) return [];
  const digraph = DIGRAPHS.find((d) => w.startsWith(d));
  const head = digraph ?? w[0];
  return [head, ...graphemes(w.slice(head.length))];
}

// c, k and ck make the same sound and share one recording; q ("kw") starts with it too.
// Letters in a group are never offered against each other.
const SOUND_GROUPS = Object.freeze([['c', 'k', 'q', 'ck']]);
export const PHONEME_SOURCE = Object.freeze({ k: 'c', ck: 'c' });
export const soundsAlike = (a, b) => a === b || SOUND_GROUPS.some((g) => g.includes(a) && g.includes(b));

// No reliable picturable short-/i/ word exists in OpenMoji, so 'i' has no first-sound item.
// No word a child knows starts with x's "ks" sound, so x is practised through blends (fox, box, six);
// likewise ng and ck only come at the ends of words, and no picturable word starts with a vowel team.
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
  l: ['lion', 'lemon'],
  j: ['jellyfish', 'juice'],
  v: ['volcano', 'violin'],
  w: ['worm', 'watermelon'],
  y: ['yoyo', 'yarn'],
  z: ['zebra', 'zero'],
  q: ['queen'],
  sh: ['ship', 'sheep'],
  ch: ['chick', 'cheese'],
  th: ['thumb', 'three'],
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

// Sight words can't be sounded out yet, so they are learned by sight: id -> how the word is written.
export const SIGHT_WORDS = Object.freeze({ the: 'the', i: 'I', a: 'a', is: 'is' });

// More than three sounds, e.g. f-r-o-g.
export const isLongWord = (w) => graphemes(w).length > 3;

export const BLEND_WORDS = Object.freeze(['pin', 'tap', 'pan', 'tin', 'sip', 'nap', 'dog', 'pig', 'map', 'sad', 'man',
  'cat', 'cap', 'pen', 'ten', 'sun', 'nut', 'cup',
  'hat', 'bag', 'bed', 'bus', 'bug', 'log', 'leg', 'web',
  'fox', 'box', 'six',
  'fish', 'ship', 'chick', 'duck', 'sock', 'rock', 'bath', 'ring',
  // Longer words with consonant blends.
  'frog', 'stop', 'hand', 'crab', 'drum', 'flag', 'milk', 'clock', 'plant', 'nest', 'tent', 'gift',
  // Vowel teams (oo as in moon, ow as in cow).
  'bee', 'tree', 'sheep', 'three', 'moon', 'spoon', 'tooth', 'boot', 'broom', 'rain', 'snail', 'train', 'chain',
  'goat', 'boat', 'coat', 'soap', 'car', 'star', 'yarn', 'jar', 'arm', 'cart', 'corn', 'fork',
  'church', 'surf', 'cow', 'owl', 'crown', 'clown', 'coin', 'toilet', 'point']);

export const PICTURE_WORDS = Object.freeze([
  ...new Set([...Object.values(FIRST_SOUND_WORDS).flat(), ...RHYME_SETS.flat(), ...BLEND_WORDS]),
]);

export const CHEERS = Object.freeze(['great_job_1', 'great_job_2', 'great_job_3']);

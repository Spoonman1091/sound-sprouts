// Everything a grown-up can record, grouped for the recorder page. Unrecorded clips keep the Piper voice.
import { PROMPT_TEXT, LETTER_NAME_TEXT } from '../audio-script.mjs';
import { PICTURE_WORDS, SIGHT_WORDS } from '../../src/curriculum/units.js';

const PHONEMES = [
  { id: 's', label: 's', example: 'sun', tip: 'Hiss like a snake, about one second: "sssss". No "suh".' },
  { id: 'a', label: 'a', example: 'apple', tip: 'Short a, as at the start of "apple". Not the letter name "ay".' },
  { id: 't', label: 't', example: 'tent', tip: 'A quick, whispered tongue tap: "t". No "tuh" — no voice after it.' },
  { id: 'p', label: 'p', example: 'pig', tip: 'A quick, whispered lip pop: "p". No "puh" — no voice after it.' },
  { id: 'i', label: 'i', example: 'itchy', tip: 'Short i, as at the start of "itchy". Not the letter name "eye".' },
  { id: 'n', label: 'n', example: 'nest', tip: 'Hum through your nose, about one second: "nnnnn". No "nuh".' },
  { id: 'm', label: 'm', example: 'moon', tip: 'Lips closed, hum about one second: "mmmmm". No "muh".' },
  { id: 'd', label: 'd', example: 'dog', tip: 'A short, light "d" with the tongue. Keep it clipped — no "duh".' },
  { id: 'g', label: 'g', example: 'goat', tip: 'A short, light "g" from the back of the throat, as in "goat". No "guh".' },
  { id: 'o', label: 'o', example: 'octopus', tip: 'Short o, as at the start of "octopus". Not the letter name "oh".' },
  { id: 'c', label: 'c / k', example: 'cat, kite', tip: 'A quick, whispered "k" sound — no "kuh". This one recording is used for both c and k.' },
  { id: 'e', label: 'e', example: 'egg', tip: 'Short e, as at the start of "egg". Not the letter name "ee".' },
  { id: 'u', label: 'u', example: 'umbrella', tip: 'Short u, as at the start of "umbrella". Not the letter name "you".' },
  { id: 'h', label: 'h', example: 'horse', tip: 'Just a breath out, like fogging a window — no "huh".' },
  { id: 'r', label: 'r', example: 'rabbit', tip: 'A growly "rrr", held for about a second — no "ruh".' },
  { id: 'f', label: 'f', example: 'fish', tip: 'Top teeth on your lip and hold "fff" for about a second — no "fuh".' },
  { id: 'b', label: 'b', example: 'ball', tip: 'Short and bouncy, lips popping apart — keep the "uh" as tiny as you can.' },
  { id: 'l', label: 'l', example: 'lion', tip: 'Tongue behind your top teeth and hold "lll" for about a second — no "luh".' },
  { id: 'j', label: 'j', example: 'jellyfish', tip: 'Short, as at the start of "jellyfish" — keep the "uh" as tiny as you can.' },
  { id: 'v', label: 'v', example: 'volcano', tip: 'Like f but buzzy: hold "vvv" for about a second — no "vuh".' },
  { id: 'w', label: 'w', example: 'worm', tip: 'Round your lips and glide "ww" — no "wuh", and not the letter name.' },
  { id: 'x', label: 'x', example: 'fox', tip: 'The "ks" at the end of "fox" — quick and whispered, not the letter name "ex".' },
  { id: 'y', label: 'y', example: 'yo-yo', tip: 'The start of "yo-yo": a quick "yy" glide — no "yuh", and not the letter name.' },
  { id: 'z', label: 'z', example: 'zebra', tip: 'A buzzing "zzz", held for about a second — no "zuh", and not "zee".' },
  { id: 'q', label: 'q (qu)', example: 'queen', tip: 'q always comes with u: say "kw", as at the start of "queen". Quick and whispered.' },
  { id: 'sh', label: 'sh', example: 'ship', tip: 'The "be quiet" sound: hold "shhh" for about a second.' },
  { id: 'ch', label: 'ch', example: 'chick', tip: 'A quick sneeze-like "ch", as at the start of "chick" — no "chuh".' },
  { id: 'th', label: 'th', example: 'thumb', tip: 'Tongue between your teeth and blow a soft "thhh", as in "thumb" (not the buzzy "th" in "this").' },
  { id: 'ng', label: 'ng', example: 'ring', tip: 'The hum at the end of "ring": back of the tongue up, hold "nngg" for about a second.' },
  { id: 'ee', label: 'ee', example: 'bee', tip: 'A long, smiley "eee", as in "bee", held for about a second.' },
  { id: 'oo', label: 'oo', example: 'moon', tip: 'A long "ooo", as in "moon" (not the short "oo" in "book"), held for about a second.' },
  { id: 'ai', label: 'ai', example: 'rain', tip: 'A long "ay", as in "rain", held for about a second.' },
  { id: 'oa', label: 'oa', example: 'goat', tip: 'A long "oh", as in "goat", held for about a second.' },
  { id: 'ar', label: 'ar', example: 'car', tip: 'The "ar" in "car" — open wide, like at the doctor\'s, about a second.' },
  { id: 'or', label: 'or', example: 'fork', tip: 'The "or" in "fork", held for about a second.' },
  { id: 'ur', label: 'ur', example: 'fur', tip: 'The "ur" in "fur", held for about a second.' },
  { id: 'ow', label: 'ow', example: 'cow', tip: 'The "ow" in "cow" (like when you bump your knee), not the "oh" in "snow".' },
  { id: 'oi', label: 'oi', example: 'coin', tip: 'The "oi" in "coin", as in "oink" without the "nk".' },
  { id: 'er', label: 'er', example: 'flower', tip: 'The soft "uh" at the end of "flower" — short and relaxed, no "r" growl.' },
  { id: 'igh', label: 'igh', example: 'night', tip: 'The "eye" sound in "night", held for about a second.' },
  { id: 'ear', label: 'ear', example: 'ear', tip: 'The word "ear" — the sound in "beard" and "hear".' },
];

const LEAD_IN = 'A sound or word plays right after this, so let your voice trail off as if you are about to say it.';
const PROMPT_TIPS = Object.freeze({
  which_starts_with: LEAD_IN,
  which_rhymes_with: LEAD_IN,
  find_the_letter: LEAD_IN,
  find_the_word: LEAD_IN,
});

const SIGHT_WORD_TIPS = Object.freeze({
  the: 'Say "the" the everyday way, as in "the cat" ("thuh").',
  i: 'Say "I", as in "I can".',
  a: 'Say "a" the everyday way, as in "a cat" ("uh"), not the letter name "ay".',
  is: 'Say "is", as in "it is".',
});
const promptTip = (id) => PROMPT_TIPS[id] ?? 'Say it warmly and a little slowly, the way you would talk to her.';

export const RECORDING_GROUPS = Object.freeze([
  { kind: 'phoneme', title: 'Letter sounds', optional: false, clips: PHONEMES },
  {
    kind: 'prompt', title: 'Instructions and praise', optional: false,
    clips: Object.entries(PROMPT_TEXT).map(([id, text]) => ({ id, label: text, tip: promptTip(id) })),
  },
  {
    kind: 'word', title: 'Sight words', optional: false,
    clips: Object.entries(SIGHT_WORDS).map(([id, text]) => ({ id, label: text, tip: SIGHT_WORD_TIPS[id] })),
  },
  {
    kind: 'word', title: 'Picture words', optional: true,
    clips: [...PICTURE_WORDS].sort().map((w) => ({ id: w, label: w, tip: 'Say the word clearly once, like naming the picture.' })),
  },
  {
    kind: 'letter', title: 'Letter names (used when spelling her name)', optional: true,
    clips: Object.keys(LETTER_NAME_TEXT).map((l) => ({ id: l, label: l.toUpperCase(), tip: `Say the letter's name, e.g. "${LETTER_NAME_TEXT[l].replace('.', '')}".` })),
  },
]);

export const RECORDING_CLIPS = Object.freeze(
  RECORDING_GROUPS.flatMap((group) => group.clips.map((clip) => ({ ...clip, kind: group.kind }))),
);

export const findClip = (kind, id) => RECORDING_CLIPS.find((c) => c.kind === kind && c.id === id) ?? null;

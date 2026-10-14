// Everything a grown-up can record, grouped for the recorder page. Unrecorded clips keep the Piper voice.
import { PROMPT_TEXT, LETTER_NAME_TEXT } from '../audio-script.mjs';
import { PICTURE_WORDS } from '../../src/curriculum/units.js';

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
];

const LEAD_IN = 'A sound or word plays right after this, so let your voice trail off as if you are about to say it.';
const PROMPT_TIPS = Object.freeze({
  which_starts_with: LEAD_IN,
  which_rhymes_with: LEAD_IN,
  find_the_letter: LEAD_IN,
});
const promptTip = (id) => PROMPT_TIPS[id] ?? 'Say it warmly and a little slowly, the way you would talk to her.';

export const RECORDING_GROUPS = Object.freeze([
  { kind: 'phoneme', title: 'Letter sounds', optional: false, clips: PHONEMES },
  {
    kind: 'prompt', title: 'Instructions and praise', optional: false,
    clips: Object.entries(PROMPT_TEXT).map(([id, text]) => ({ id, label: text, tip: promptTip(id) })),
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

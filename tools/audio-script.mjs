import { PICTURE_WORDS } from '../src/curriculum/units.js';

export const PROMPT_TEXT = Object.freeze({
  which_starts_with: 'Which one starts with...',
  which_rhymes_with: 'Which one rhymes with...',
  find_the_letter: 'Find the letter that says...',
  tap_each_letter: 'Tap each letter. Then hop them together!',
  which_picture: 'Which picture is it?',
  spell_your_name: "Let's spell your name!",
  great_job_1: 'Great job!',
  great_job_2: 'You did it!',
  great_job_3: 'Yes! Nice listening!',
  try_again: "Hmm. Let's try again.",
  all_done: 'All done for today! Look how your garden grows.',
  new_flower: 'Wow! A new flower bloomed!',
  lets_play: "Let's play!",
  find_the_word: 'Find the word...',
});

// Spelled phonetically because TTS often reads a bare "a" as "uh".
export const LETTER_NAME_TEXT = Object.freeze({
  a: 'Ay.', b: 'Bee.', c: 'See.', d: 'Dee.', e: 'Ee.', f: 'Ef.', g: 'Jee.', h: 'Aitch.', i: 'Eye.',
  j: 'Jay.', k: 'Kay.', l: 'El.', m: 'Em.', n: 'En.', o: 'Oh.', p: 'Pee.', q: 'Cue.', r: 'Ar.',
  s: 'Ess.', t: 'Tee.', u: 'You.', v: 'Vee.', w: 'Double you.', x: 'Ex.', y: 'Why.', z: 'Zee.',
});

// Sight words are spelled for the TTS fallback so "a" comes out as "uh".
const SIGHT_WORD_TEXT = Object.freeze({ the: 'the.', i: 'I.', a: 'uh.', is: 'is.' });
export const WORD_TEXT = Object.freeze({
  ...Object.fromEntries(PICTURE_WORDS.map((w) => [w, `${w}.`])),
  ...SIGHT_WORD_TEXT,
});

import { CONFIG } from '../config.js';
import { LETTER_ORDER, FIRST_SOUND_WORDS, RHYME_SETS, BLEND_WORDS, CHEERS, soundsAlike, graphemes } from './units.js';
import { shuffle, pick } from './random.js';
import { unlockedLetters } from './unlock.js';
import { phoneme, word, prompt, imgPath, letterName } from '../audio/clips.js';
import { nameLetters } from '../state/name.js';

const pictureChoice = (w, correct) => ({ id: w, label: w, img: imgPath(w), audio: word(w), correct });
// Letters are narrated by name ("ess, aitch" for sh); saying their sounds would give the answer away.
const letterChoice = (l, correct) => ({ id: l, label: l, audio: phoneme(l), narration: [...l].map(letterName), correct });

const distinct = (pool, count, rng) => shuffle([...new Set(pool)], rng).slice(0, count);
const pictureDistractors = (pool, rng) => distinct(pool, CONFIG.PICTURE_CHOICES - 1, rng).map((w) => pictureChoice(w, false));

function assertKnown(condition, itemId) {
  if (!condition) throw new Error(`Unknown item id: ${itemId}`);
}

function rhymeTask(index, rng) {
  const [target, ...rhymes] = RHYME_SETS[index];
  const others = RHYME_SETS.filter((_, i) => i !== index).flat();
  return {
    activity: 'pickOne',
    focusImg: imgPath(target),
    focusAudio: word(target),
    focusLabel: target,
    narrate: true,
    prompt: [prompt('which_rhymes_with'), word(target)],
    choices: shuffle([pictureChoice(pick(rhymes, rng), true), ...pictureDistractors(others, rng)], rng),
  };
}

// s/sh, c/ch and t/th look alike at the start of a word, so they are never distractors for each other here.
const clearlyDifferent = (l, letter) => !soundsAlike(l, letter) && l[0] !== letter[0];

function firstSoundTask(letter, rng) {
  const others = Object.entries(FIRST_SOUND_WORDS).filter(([l]) => clearlyDifferent(l, letter)).flatMap(([, ws]) => ws);
  return {
    activity: 'pickOne',
    narrate: true,
    prompt: [prompt('which_starts_with'), phoneme(letter)],
    choices: shuffle([pictureChoice(pick(FIRST_SOUND_WORDS[letter], rng), true), ...pictureDistractors(others, rng)], rng),
  };
}

function letterSoundTask(letter, progress, rng) {
  // Prefer letters already taught; top up with later letters so there are always enough choices.
  const unlocked = unlockedLetters(progress);
  const taught = shuffle(unlocked.filter((l) => !soundsAlike(l, letter)), rng);
  const later = shuffle(LETTER_ORDER.filter((l) => !unlocked.includes(l) && !soundsAlike(l, letter)), rng);
  const distractors = [...taught, ...later].slice(0, CONFIG.LETTER_CHOICES - 1);
  return {
    activity: 'pickOne',
    narrate: true,
    prompt: [prompt('find_the_letter'), phoneme(letter)],
    choices: shuffle([letterChoice(letter, true), ...distractors.map((l) => letterChoice(l, false))], rng),
  };
}

function blendTask(w, rng) {
  const others = BLEND_WORDS.filter((x) => x !== w);
  return { activity: 'blend', word: w, letters: graphemes(w), choices: shuffle([pictureChoice(w, true), ...pictureDistractors(others, rng)], rng) };
}

function nameTask(progress, rng) {
  const letters = nameLetters(progress.childName);
  return {
    activity: 'nameSpell',
    name: progress.childName.trim().split(/\s+/)[0],
    letters,
    tileOrder: shuffle(letters.map((_, i) => i), rng),
  };
}

export function buildTask(itemId, { progress, rng = Math.random }) {
  const [kind, arg] = itemId.split(':');
  const builders = {
    rhyme: () => { assertKnown(RHYME_SETS[Number(arg)], itemId); return rhymeTask(Number(arg), rng); },
    fs: () => { assertKnown(FIRST_SOUND_WORDS[arg], itemId); return firstSoundTask(arg, rng); },
    ls: () => { assertKnown(LETTER_ORDER.includes(arg), itemId); return letterSoundTask(arg, progress, rng); },
    blend: () => { assertKnown(BLEND_WORDS.includes(arg), itemId); return blendTask(arg, rng); },
    name: () => { assertKnown(nameLetters(progress.childName).length > 0, itemId); return nameTask(progress, rng); },
  };
  assertKnown(builders[kind], itemId);
  return { itemId, cheer: prompt(pick(CHEERS, rng)), ...builders[kind]() };
}

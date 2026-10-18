import { runPickOne } from './pick-one.js';
import { runBlend } from './blend.js';
import { runNameSpell } from './name-spell.js';
import { runIntro } from './intro.js';

export const ACTIVITIES = Object.freeze({ pickOne: runPickOne, blend: runBlend, nameSpell: runNameSpell, intro: runIntro });

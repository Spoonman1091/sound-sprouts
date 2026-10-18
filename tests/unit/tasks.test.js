import { describe, it, expect } from 'vitest';
import { createProgress, setChildName } from '../../src/state/progress.js';
import { buildTask } from '../../src/curriculum/tasks.js';
import { RHYME_SETS, FIRST_SOUND_WORDS, BLEND_WORDS, LETTER_ORDER, SIGHT_WORDS } from '../../src/curriculum/units.js';
import { prompt, phoneme, word, letterName } from '../../src/audio/clips.js';
import { seededRng, withMastered } from '../helpers.js';

const fresh = createProgress();
const correctOf = (task) => task.choices.filter((c) => c.correct);

describe('buildTask', () => {
  it.each([1, 2, 3, 4, 5])('rhyme task (seed %i) asks about the target and offers one rhyme', (seed) => {
    const task = buildTask('rhyme:0', { progress: fresh, rng: seededRng(seed) });
    const [target, ...rhymes] = RHYME_SETS[0];
    expect(task.activity).toBe('pickOne');
    expect(task.prompt).toEqual([prompt('which_rhymes_with'), word(target)]);
    expect(task.focusImg).toBe(`assets/img/${target}.svg`);
    expect(task.focusAudio).toBe(word(target));
    expect(task.focusLabel).toBe(target);
    expect(correctOf(task)).toHaveLength(1);
    expect(rhymes).toContain(correctOf(task)[0].id);
    expect(task.choices).toHaveLength(3);
    task.choices.filter((c) => !c.correct).forEach((c) => expect(RHYME_SETS[0]).not.toContain(c.id));
  });

  it.each(['rhyme:0', 'fs:s', 'ls:s', 'sight:the'])('%s asks a lead-in followed by one word or sound', (id) => {
    expect(buildTask(id, { progress: fresh, rng: seededRng(1) }).prompt).toHaveLength(2);
  });

  it('narrates the choices for rhyme, first-sound and letter questions, but not blends', () => {
    const narrate = (id) => buildTask(id, { progress: fresh, rng: seededRng(1) }).narrate;
    expect(narrate('rhyme:0')).toBe(true);
    expect(narrate('fs:s')).toBe(true);
    expect(narrate('ls:s')).toBe(true);
    expect(narrate('blend:pin')).toBeFalsy();
  });

  it('letter choices are narrated by letter name, so the sound is not given away', () => {
    const all = withMastered(undefined, LETTER_ORDER.map((l) => `ls:${l}`));
    const task = buildTask('ls:sh', { progress: all, rng: seededRng(2) });
    task.choices.forEach((c) => {
      expect(c.narration).toEqual([...c.id].map(letterName));
      expect(c.narration).not.toContain(phoneme('sh'));
    });
    expect(task.choices.find((c) => c.correct).narration).toEqual([letterName('s'), letterName('h')]);
  });

  it('first-sound task offers a matching word and a non-matching distractor', () => {
    const task = buildTask('fs:s', { progress: fresh, rng: seededRng(3) });
    expect(task.prompt).toEqual([prompt('which_starts_with'), phoneme('s')]);
    expect(FIRST_SOUND_WORDS.s).toContain(correctOf(task)[0].id);
    expect(task.choices).toHaveLength(3);
    task.choices.filter((c) => !c.correct).forEach((c) => expect(c.id[0]).not.toBe('s'));
  });

  it('letter-sound task only uses unlocked letters, at most LETTER_CHOICES', () => {
    const progress = withMastered(undefined, ['ls:s', 'ls:a', 'ls:t']);
    const task = buildTask('ls:t', { progress, rng: seededRng(9) });
    expect(task.prompt).toEqual([prompt('find_the_letter'), phoneme('t')]);
    expect(task.choices).toHaveLength(3);
    task.choices.forEach((c) => expect(['s', 'a', 't', 'p']).toContain(c.label));
    expect(correctOf(task)[0].label).toBe('t');
  });

  it.each([1, 2, 3, 4])('letter-sound task (seed %i) has three distinct choices even when only two letters are open', (seed) => {
    const task = buildTask('ls:s', { progress: fresh, rng: seededRng(seed) });
    expect(task.choices).toHaveLength(3);
    expect(new Set(task.choices.map((c) => c.id)).size).toBe(3);
    expect(task.choices.filter((c) => c.correct).map((c) => c.id)).toEqual(['s']);
    task.choices.forEach((c) => expect(LETTER_ORDER).toContain(c.id));
  });

  it.each([1, 2, 3, 4, 5, 6])('picture distractors (seed %i) are distinct', (seed) => {
    ['rhyme:3', 'fs:p', 'blend:tin'].forEach((id) => {
      const task = buildTask(id, { progress: fresh, rng: seededRng(seed) });
      expect(new Set(task.choices.map((c) => c.id)).size).toBe(3);
    });
  });

  it('blend task splits the word and pictures it among two choices', () => {
    const task = buildTask('blend:pin', { progress: fresh, rng: seededRng(2) });
    expect(task).toMatchObject({ activity: 'blend', word: 'pin', letters: ['p', 'i', 'n'] });
    expect(correctOf(task)[0].id).toBe('pin');
    expect(task.choices).toHaveLength(3);
    task.choices.forEach((c) => expect(BLEND_WORDS).toContain(c.id));
  });

  it('name task shuffles tile order over all name letters', () => {
    const task = buildTask('name', { progress: setChildName(fresh, 'Anna Lee'), rng: seededRng(4) });
    expect(task.activity).toBe('nameSpell');
    expect(task.name).toBe('Anna');
    expect([...task.tileOrder].sort()).toEqual([0, 1, 2, 3]);
  });

  it('c, k and ck share one recording', () => {
    expect(phoneme('k')).toBe(phoneme('c'));
    expect(phoneme('ck')).toBe(phoneme('c'));
  });

  it('blend tiles are sounds, so digraphs stay on one tile', () => {
    expect(buildTask('blend:fish', { progress: fresh, rng: seededRng(1) }).letters).toEqual(['f', 'i', 'sh']);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('first-sound distractors never begin with the same letter as the target (seed %i)', (seed) => {
    ['s', 'sh', 'c', 'ch', 't', 'th', 'e', 'ear'].forEach((target) => {
      const task = buildTask(`fs:${target}`, { progress: fresh, rng: seededRng(seed) });
      task.choices.filter((c) => !c.correct).forEach((c) => expect(c.id[0]).not.toBe(target[0]));
    });
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('never offers both c and k as letter choices (seed %i)', (seed) => {
    const all = withMastered(undefined, LETTER_ORDER.map((l) => `ls:${l}`));
    ['c', 'k'].forEach((target) => {
      const ids = buildTask(`ls:${target}`, { progress: all, rng: seededRng(seed) }).choices.map((c) => c.id);
      expect(ids.filter((id) => id === 'c' || id === 'k')).toEqual([target]);
    });
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('never offers c or k against q (seed %i)', (seed) => {
    const all = withMastered(undefined, LETTER_ORDER.map((l) => `ls:${l}`));
    const ids = buildTask('ls:q', { progress: all, rng: seededRng(seed) }).choices.map((c) => c.id);
    expect(ids).not.toContain('c');
    expect(ids).not.toContain('k');
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('first-sound /k/ and /kw/ distractors never start with c, k or q (seed %i)', (seed) => {
    ['c', 'k', 'q'].forEach((target) => {
      const task = buildTask(`fs:${target}`, { progress: fresh, rng: seededRng(seed) });
      const kSounds = ['c', 'k', 'q'].flatMap((l) => FIRST_SOUND_WORDS[l]);
      task.choices.filter((c) => !c.correct).forEach((c) => expect(kSounds).not.toContain(c.id));
    });
  });

  it('every task carries a cheer clip', () => {
    expect(buildTask('ls:s', { progress: fresh, rng: seededRng(1) }).cheer).toMatch(/assets\/audio\/prompt\/great_job_\d\.mp3/);
  });

  it.each(['zzz:1', 'fs:i', 'fs:x', 'fs:ng', 'fs:ck', 'rhyme:99', 'blend:zap', 'ls:1', 'sight:was', 'name'])('throws for unknown item %s', (id) => {
    expect(() => buildTask(id, { progress: fresh, rng: seededRng(1) })).toThrow();
  });

  it.each(Object.keys(SIGHT_WORDS))('sight word task for "%s" asks to find the spoken word among three written words', (id) => {
    const task = buildTask(`sight:${id}`, { progress: fresh, rng: seededRng(4) });
    expect(task.activity).toBe('pickOne');
    expect(task.prompt).toEqual([prompt('find_the_word'), word(id)]);
    expect(task.narrate).toBeFalsy();
    expect(task.choices).toHaveLength(3);
    expect(new Set(task.choices.map((c) => c.id)).size).toBe(3);
    task.choices.forEach((c) => {
      expect(c.label).toBe(SIGHT_WORDS[c.id]);
      expect(c.audio).toBe(word(c.id));
      expect(c.img).toBeUndefined();
    });
    expect(task.choices.filter((c) => c.correct).map((c) => c.id)).toEqual([id]);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('early letter questions only ever show single letters (seed %i)', (seed) => {
    ['s', 'a'].forEach((target) => {
      const ids = buildTask(`ls:${target}`, { progress: fresh, rng: seededRng(seed) }).choices.map((c) => c.id);
      ids.forEach((id) => expect(id).toHaveLength(1));
    });
  });

  it.each([1, 2, 3, 4])('a multi-letter sound can still be offered against single letters (seed %i)', (seed) => {
    const singles = withMastered(undefined, LETTER_ORDER.filter((l) => l.length === 1).map((l) => `ls:${l}`));
    const task = buildTask('ls:sh', { progress: singles, rng: seededRng(seed) });
    expect(task.choices).toHaveLength(3);
    expect(task.choices.filter((c) => c.correct).map((c) => c.id)).toEqual(['sh']);
  });
});


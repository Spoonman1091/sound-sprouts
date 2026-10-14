import { describe, it, expect } from 'vitest';
import { createProgress, setChildName } from '../../src/state/progress.js';
import { buildTask } from '../../src/curriculum/tasks.js';
import { RHYME_SETS, FIRST_SOUND_WORDS, BLEND_WORDS } from '../../src/curriculum/units.js';
import { prompt, phoneme, word } from '../../src/audio/clips.js';
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
    expect(correctOf(task)).toHaveLength(1);
    expect(rhymes).toContain(correctOf(task)[0].id);
    expect(RHYME_SETS[0]).not.toContain(task.choices.find((c) => !c.correct).id);
  });

  it('first-sound task offers a matching word and a non-matching distractor', () => {
    const task = buildTask('fs:s', { progress: fresh, rng: seededRng(3) });
    expect(task.prompt).toEqual([prompt('which_starts_with'), phoneme('s')]);
    expect(FIRST_SOUND_WORDS.s).toContain(correctOf(task)[0].id);
    expect(task.choices.find((c) => !c.correct).id[0]).not.toBe('s');
  });

  it('letter-sound task only uses unlocked letters, at most LETTER_CHOICES', () => {
    const progress = withMastered(undefined, ['ls:s', 'ls:a', 'ls:t']);
    const task = buildTask('ls:t', { progress, rng: seededRng(9) });
    expect(task.prompt).toEqual([prompt('find_the_letter'), phoneme('t')]);
    expect(task.choices).toHaveLength(3);
    task.choices.forEach((c) => expect(['s', 'a', 't', 'p']).toContain(c.label));
    expect(correctOf(task)[0].label).toBe('t');
  });

  it('letter-sound task has two choices when only two letters are open', () => {
    expect(buildTask('ls:s', { progress: fresh, rng: seededRng(1) }).choices).toHaveLength(2);
  });

  it('blend task splits the word and pictures it among two choices', () => {
    const task = buildTask('blend:pin', { progress: fresh, rng: seededRng(2) });
    expect(task).toMatchObject({ activity: 'blend', word: 'pin', letters: ['p', 'i', 'n'] });
    expect(correctOf(task)[0].id).toBe('pin');
    expect(BLEND_WORDS).toContain(task.choices.find((c) => !c.correct).id);
  });

  it('name task shuffles tile order over all name letters', () => {
    const task = buildTask('name', { progress: setChildName(fresh, 'Anna Lee'), rng: seededRng(4) });
    expect(task.activity).toBe('nameSpell');
    expect(task.name).toBe('Anna');
    expect([...task.tileOrder].sort()).toEqual([0, 1, 2, 3]);
  });

  it('every task carries a cheer clip', () => {
    expect(buildTask('ls:s', { progress: fresh, rng: seededRng(1) }).cheer).toMatch(/assets\/audio\/prompt\/great_job_\d\.mp3/);
  });

  it.each(['zzz:1', 'fs:i', 'fs:q', 'rhyme:99', 'blend:dog', 'ls:z', 'name'])('throws for unknown item %s', (id) => {
    expect(() => buildTask(id, { progress: fresh, rng: seededRng(1) })).toThrow();
  });
});

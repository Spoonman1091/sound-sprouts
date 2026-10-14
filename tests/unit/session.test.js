import { describe, it, expect, vi } from 'vitest';
import { CONFIG } from '../../src/config.js';
import { createProgress } from '../../src/state/progress.js';
import { runSession } from '../../src/screens/session.js';
import { fakePlayer, seededRng } from '../helpers.js';

const fakeActivities = (answers) => {
  let i = 0;
  const run = vi.fn(async () => ({ firstTry: answers[i++] }));
  return { pickOne: run, blend: run, nameSpell: run };
};

describe('runSession', () => {
  it('runs every planned item, saving after each one, then records the session', async () => {
    const container = document.createElement('div');
    const saves = [];
    let clock = 100;
    const result = await runSession({
      container,
      progress: createProgress(),
      planIds: ['rhyme:0', 'ls:s', 'fs:s'],
      sessionId: 'sess-1',
      deps: { player: fakePlayer(), activities: fakeActivities([true, false, true]), wait: async () => {} },
      save: (p) => saves.push(p),
      now: () => (clock += 1),
      rng: seededRng(1),
    });
    expect(saves).toHaveLength(4);
    expect(saves[0].items['rhyme:0'].attempts).toHaveLength(1);
    expect(saves[1].items['ls:s'].attempts[0]).toMatchObject({ firstTry: false, sessionId: 'sess-1' });
    expect(result.sessions).toEqual([{ sessionId: 'sess-1', at: 104, itemCount: 3 }]);
    expect(container.querySelectorAll('.dot.filled')).toHaveLength(3);
  });

  it('keeps completed items saved if the session is abandoned mid-way', async () => {
    const saves = [];
    const never = new Promise(() => {});
    let calls = 0;
    const run = vi.fn(() => (calls++ === 0 ? Promise.resolve({ firstTry: true }) : never));
    runSession({
      container: document.createElement('div'),
      progress: createProgress(),
      planIds: ['ls:s', 'ls:a'],
      sessionId: 's',
      deps: { player: fakePlayer(), activities: { pickOne: run, blend: run, nameSpell: run }, wait: async () => {} },
      save: (p) => saves.push(p),
      now: () => 1,
      rng: seededRng(1),
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(saves).toHaveLength(1);
    expect(saves[0].items['ls:s']).toBeDefined();
  });

  it('pauses after every item so one activity does not tumble into the next', async () => {
    const order = [];
    const run = vi.fn(async () => { order.push('activity'); return { firstTry: true }; });
    const wait = vi.fn(async (ms) => { order.push(`wait ${ms}`); });
    await runSession({
      container: document.createElement('div'),
      progress: createProgress(),
      planIds: ['ls:s', 'ls:a'],
      sessionId: 's',
      deps: { player: fakePlayer(), activities: { pickOne: run, blend: run, nameSpell: run }, wait },
      save: () => {},
      now: () => 1,
      rng: seededRng(1),
    });
    const pause = `wait ${CONFIG.TRANSITION_MS}`;
    expect(order).toEqual(['activity', pause, 'activity', pause]);
    expect(CONFIG.TRANSITION_MS).toBeGreaterThanOrEqual(600);
  });
});

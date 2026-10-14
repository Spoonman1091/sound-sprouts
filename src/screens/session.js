import { el } from '../ui/dom.js';
import { buildTask } from '../curriculum/tasks.js';
import { ACTIVITIES } from '../activities/index.js';
import { recordAttempt, recordSession } from '../state/progress.js';
import { CONFIG } from '../config.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function renderShell(container, total) {
  const dots = Array.from({ length: total }, () => el('span', { class: 'dot' }));
  const stage = el('main', { class: 'stage' });
  container.replaceChildren(el('div', { class: 'session' }, [
    el('div', { class: 'dots', 'aria-hidden': 'true' }, dots),
    stage,
  ]));
  return { stage, markDone: (index) => dots[index].classList.add('filled') };
}

export async function runSession({ container, progress, planIds, sessionId, deps, save, now = Date.now, rng = Math.random }) {
  const activities = deps.activities ?? ACTIVITIES;
  const wait = deps.wait ?? pause;
  const shell = renderShell(container, planIds.length);
  let current = progress;
  for (const [index, itemId] of planIds.entries()) {
    const task = buildTask(itemId, { progress: current, rng });
    const { firstTry } = await activities[task.activity](shell.stage, task, { ...deps, settleMs: CONFIG.SETTLE_MS });
    current = recordAttempt(current, { itemId, firstTry, sessionId, at: now() });
    save(current);
    shell.markDone(index);
    // A breather after the cheer: the finished activity fades out before the next one (or the done screen) fades in.
    shell.stage.firstElementChild?.classList.add('leaving');
    await wait(CONFIG.TRANSITION_MS);
  }
  const finished = recordSession(current, { sessionId, at: now(), itemCount: planIds.length });
  save(finished);
  return finished;
}

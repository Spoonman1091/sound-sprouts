import { el } from '../ui/dom.js';
import { buildTask } from '../curriculum/tasks.js';
import { ACTIVITIES } from '../activities/index.js';
import { markIntroduced } from '../state/progress.js';
import { CONFIG } from '../config.js';

// "Meet the letter" again from a garden tap: just the introduction, then back home.
export async function runMeet({ container, sound, progress, deps, rng = Math.random }) {
  const activities = deps.activities ?? ACTIVITIES;
  const stage = el('main', { class: 'stage' });
  container.replaceChildren(el('div', { class: 'session' }, [stage]));
  const task = buildTask(`intro:${sound}`, { progress, rng });
  await activities.intro(stage, task, { ...deps, settleMs: CONFIG.SETTLE_MS, leadInGapMs: CONFIG.LEAD_IN_GAP_MS, narrateGapMs: CONFIG.NARRATION_GAP_MS });
  return markIntroduced(progress, sound);
}

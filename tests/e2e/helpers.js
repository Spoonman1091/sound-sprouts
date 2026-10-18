import { expect } from '@playwright/test';

// Aborting audio makes every clip fail instantly, so sessions run fast; the player must cope (Review Focus 2).
export const blockAudio = (page) => page.route('**/*.mp3', (route) => route.abort());

async function pickCorrect(page) {
  const ready = page.locator('.pick-one[data-ready="true"]');
  await ready.waitFor();
  await ready.locator('[data-correct="true"]').click();
}

async function blendWord(page) {
  const blend = page.locator('.blend');
  const tiles = blend.locator('.tile');
  const count = await tiles.count();
  for (let i = 0; i < count; i += 1) {
    await expect(blend).toHaveAttribute('data-ready', 'true');
    await tiles.nth(i).click();
  }
  await expect(blend).toHaveAttribute('data-ready', 'true');
  await blend.locator('.hop').click();
  await pickCorrect(page);
}

async function spellName(page, name) {
  const spell = page.locator('.name-spell');
  for (const ch of name) {
    await expect(spell).toHaveAttribute('data-ready', 'true');
    await spell.locator(`.tile[data-char="${ch}"]:not([disabled])`).first().click();
  }
}

// Drag the mouse along the letter's guide, the way a finger would trace it.
export async function traceIntro(page) {
  const intro = page.locator('.intro');
  await expect(intro).toHaveAttribute('data-step', 'trace');
  const svg = intro.locator('svg.trace');
  await expect(svg).toHaveAttribute('data-ready', 'true');
  const points = await svg.evaluate((s) => {
    const ctm = s.getScreenCTM();
    return JSON.parse(s.dataset.checkpoints).map(([x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform(ctm);
      return [p.x, p.y];
    });
  });
  await page.mouse.move(...points[0]);
  await page.mouse.down();
  for (const [x, y] of points) await page.mouse.move(x, y);
  await page.mouse.up();
}

export async function answerCurrent(page, name = '') {
  const activity = page.locator('.stage > .activity');
  await activity.waitFor();
  const cls = await activity.getAttribute('class');
  if (cls.includes('intro')) return traceIntro(page);
  if (cls.includes('name-spell')) return spellName(page, name);
  if (cls.includes('blend')) return blendWord(page);
  return pickCorrect(page);
}

// Answer the activity on screen, then wait out the pause until it has faded away.
export async function answerNext(page, name = '') {
  await page.locator('.stage > .activity').waitFor();
  const current = await page.locator('.stage > .activity').elementHandle();
  await answerCurrent(page, name);
  await page.waitForFunction((el) => !el.isConnected, current, { timeout: 15_000 });
}

export async function playWholeSession(page, { name = '' } = {}) {
  await page.getByRole('button', { name: 'Play' }).click();
  const dots = page.locator('.dot');
  await dots.first().waitFor();
  const total = await dots.count();
  for (let step = 0; step < total; step += 1) {
    await answerNext(page, name);
    if (step < total - 1) await expect(page.locator('.dot.filled')).toHaveCount(step + 1);
  }
  await expect(page.locator('.done')).toBeVisible();
  return total;
}

export async function holdGear(page) {
  const gear = page.getByRole('button', { name: /Grown-ups/ });
  const box = await gear.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  const question = await page.locator('.gate p').textContent();
  const [, a, b] = /(\d+) \+ (\d+)/.exec(question);
  return Number(a) + Number(b);
}

export async function openParentDashboard(page) {
  const answer = await holdGear(page);
  await page.getByRole('button', { name: String(answer), exact: true }).click();
  await expect(page.locator('.dashboard')).toBeVisible();
}

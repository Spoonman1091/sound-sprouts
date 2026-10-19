import { test, expect } from '@playwright/test';
import { blockAudio, playWholeSession, answerNext, traceIntro } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockAudio(page);
  await page.goto('/');
});

test('home shows the garden of single letters with two sprouts', async ({ page }) => {
  await expect(page.locator('.plot')).toHaveCount(26);
  await expect(page.locator('.plot[data-status="sprout"]')).toHaveCount(2);
});

test('the arrow turns the garden to the letter teams and back', async ({ page }) => {
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.plot').first()).toHaveAttribute('data-letter', 'sh');
  await expect(page.getByRole('button', { name: 'Next page' })).toBeHidden();
  const fits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
  expect(fits).toBe(true);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.locator('.plot').first()).toHaveAttribute('data-letter', 's');
});

test('a full session completes and is saved', async ({ page }) => {
  const total = await playWholeSession(page);
  expect(total).toBe(2 + 8);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(saved.sessions).toHaveLength(1);
  await page.getByRole('button', { name: 'Back to the garden' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('choices are big enough for small fingers', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await answerNext(page);
  await answerNext(page);
  const choice = page.locator('.choice').first();
  await choice.waitFor();
  const box = await choice.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(96);
  expect(box.height).toBeGreaterThanOrEqual(96);
});

test('progress from a half-finished session survives a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  for (const step of [1, 2, 3]) {
    await answerNext(page);
    await expect(page.locator('.dot.filled')).toHaveCount(step);
  }
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(saved.introduced).toEqual(['s', 'a']);
  expect(Object.keys(saved.items)).toHaveLength(1);
});

test('the page never scrolls sideways', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await page.locator('.activity').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('the whole garden and the Play button fit on screen without scrolling', async ({ page }) => {
  await expect(page.locator('.plot').first()).toBeVisible();
  const fits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
  expect(fits).toBe(true);
  await expect(page.getByRole('button', { name: 'Play' })).toBeInViewport({ ratio: 1 });
});

test('a first lesson starts by meeting s: big letter, pictures, then tracing', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  const intro = page.locator('.intro');
  await expect(intro).toHaveAttribute('data-step', 'meet');
  await expect(intro.locator('.intro-meet .intro-letter')).toHaveText('s');
  await expect(intro.locator('.example')).toHaveCount(2);
  await traceIntro(page);
  await expect(intro).toHaveAttribute('data-step', 'say');
});

test('tapping an open garden plot meets that letter again, then goes home', async ({ page }) => {
  await page.getByRole('button', { name: 'Meet a' }).click();
  await expect(page.locator('.intro .intro-meet .intro-letter')).toHaveText('a');
  await traceIntro(page);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 15_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(saved.introduced).toEqual(['a']);
  await expect(page.locator('.plot[data-letter="t"]')).not.toHaveAttribute('role', 'button');
});

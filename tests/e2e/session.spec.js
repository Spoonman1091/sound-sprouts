import { test, expect } from '@playwright/test';
import { blockAudio, playWholeSession } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await blockAudio(page);
  await page.goto('/');
});

test('home shows the garden with two sprouts', async ({ page }) => {
  await expect(page.locator('.plot')).toHaveCount(10);
  await expect(page.locator('.plot[data-status="sprout"]')).toHaveCount(2);
});

test('a full session completes and is saved', async ({ page }) => {
  const total = await playWholeSession(page);
  expect(total).toBe(8);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(saved.sessions).toHaveLength(1);
  await page.getByRole('button', { name: 'Back to the garden' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('choices are big enough for small fingers', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  const choice = page.locator('.choice').first();
  await choice.waitFor();
  const box = await choice.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(96);
  expect(box.height).toBeGreaterThanOrEqual(96);
});

test('progress from a half-finished session survives a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  const ready = page.locator('.pick-one[data-ready="true"]');
  await ready.waitFor();
  await ready.locator('[data-correct="true"]').click();
  await expect(page.locator('.dot.filled')).toHaveCount(1);
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(Object.keys(saved.items)).toHaveLength(1);
});

test('the page never scrolls sideways', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await page.locator('.activity').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

import { test, expect } from '@playwright/test';
import { blockAudio, holdGear, openParentDashboard, playWholeSession } from './helpers.js';

test.beforeEach(async ({ page }) => { await blockAudio(page); });

test('parent sets a name and the next session starts by spelling it', async ({ page }) => {
  await page.goto('/');
  await openParentDashboard(page);
  await page.locator('#child-name').fill('Zoë');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.getByRole('button', { name: 'Back to the garden' }).click();
  await playWholeSession(page, { name: 'Zoë' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(saved.items.name.attempts).toHaveLength(1);
});

test('a wrong gate answer goes back home', async ({ page }) => {
  await page.goto('/');
  const answer = await holdGear(page);
  await page.locator('.gate-option').filter({ hasNotText: new RegExp(`^${answer}$`) }).first().click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('corrupted saved data starts fresh and tells the parent', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('sound-sprouts:v1', '{not json');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/');
  await expect(page.locator('.plot[data-status="sprout"]')).toHaveCount(2);
  await openParentDashboard(page);
  await expect(page.locator('.notice').first()).toContainText('started fresh');
});

test('a long name fits on screen without sideways scrolling', async ({ page }) => {
  await page.goto('/');
  await openParentDashboard(page);
  await page.locator('#child-name').fill('Maximilianna');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.getByRole('button', { name: 'Back to the garden' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.locator('.name-spell').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  const viewport = page.viewportSize();
  for (const slot of await page.locator('.slot').all()) {
    const box = await slot.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
});

test('a parent can mark letters mastered: they bloom and the next letter opens', async ({ page }) => {
  await page.goto('/');
  await openParentDashboard(page);
  page.on('dialog', (dialog) => dialog.accept());
  for (const row of [0, 1]) {
    await page.locator('.letters tbody tr').nth(row).getByRole('button', { name: 'Mark mastered' }).click();
    await expect(page.locator('.letters tbody tr').nth(row)).toContainText('Mastered');
  }
  await page.getByRole('button', { name: 'Back to the garden' }).click();
  await expect(page.locator('.plot[data-letter="s"]')).toHaveAttribute('data-status', 'flower');
  await expect(page.locator('.plot[data-letter="t"]')).toHaveAttribute('data-status', 'sprout');
});

test('a parent can mark a sight word mastered', async ({ page }) => {
  await page.goto('/');
  await openParentDashboard(page);
  page.on('dialog', (dialog) => dialog.accept());
  const row = page.locator('.sight-words tbody tr').first();
  await row.getByRole('button', { name: 'Mark mastered' }).click();
  await expect(row).toContainText('Mastered');
  await expect(row.getByRole('button')).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sound-sprouts:v1')));
  expect(saved.items['sight:the'].masteredAt).toBeGreaterThan(0);
});

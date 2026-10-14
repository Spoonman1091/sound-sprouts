import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('works offline after the first visit', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Offline service-worker check runs in Chromium');
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  const status = await page.evaluate(async () => (await fetch('assets/audio/prompt/lets_play.mp3', { headers: { range: 'bytes=0-9' } })).status);
  expect(status).toBe(206);
});

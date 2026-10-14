// Renders the OpenMoji seedling onto a cream background as PWA icons, using Playwright's Chromium.
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = Buffer.from(readFileSync('assets/img/seedling.svg')).toString('base64');
const ICONS = [
  { size: 180, file: 'icon-180.png', inset: 0.12 },
  { size: 192, file: 'icon-192.png', inset: 0.12 },
  { size: 512, file: 'icon-512.png', inset: 0.12 },
  { size: 512, file: 'icon-maskable-512.png', inset: 0.25 },
];

mkdirSync('assets/icons', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { size, file, inset } of ICONS) {
    const inner = Math.round(size * (1 - 2 * inset));
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:#fff7e0">
      <img src="data:image/svg+xml;base64,${svg}" style="width:${inner}px;height:${inner}px"></body>`);
    await page.screenshot({ path: `assets/icons/${file}` });
  }
} finally {
  await browser.close();
}
process.stdout.write(`Wrote ${ICONS.length} icons\n`);

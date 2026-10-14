import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: { command: 'npx http-server . -p 4173 -c-1 --silent', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'android-tablet', use: { ...devices['Galaxy Tab S4 landscape'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
  ],
});

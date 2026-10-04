/**
 * Content Studio e2e. Runs the real Next.js build against the in-memory
 * mock backend (mock-backend.mjs) at 3 widths. See README.md.
 */
import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.mjs$/,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'results/artifacts',
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/results.json' }],
    ['html', { outputFolder: 'results/html', open: 'never' }],
  ],
  use: {
    // Optional: point at an already-installed Chromium instead of Playwright's
    // pinned build (e.g. when the matching browser isn't downloaded).
    ...(process.env.CS_CHROMIUM ? { launchOptions: { executablePath: process.env.CS_CHROMIUM } } : {}),
    baseURL: process.env.CS_BASE_URL || 'http://localhost:3021',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'phone-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'tablet-768', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop-1440', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
});

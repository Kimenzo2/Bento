import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/playwright/results/phase1-results.json' }],
    ['html', { outputFolder: 'tests/playwright/results/phase1-html', open: 'never' }],
  ],
  use: {
    baseURL: 'https://iamazeyou.me',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome-desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    {
      name: 'edge-desktop',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'safari-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'chrome-mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'safari-mobile',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad Pro 11'] },
    },
  ],
});

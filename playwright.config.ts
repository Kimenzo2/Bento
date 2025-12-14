import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * 
 * This configuration sets up automated E2E testing for Genesis.
 * Tests run in CI/CD pipeline to catch regressions before deployment.
 * 
 * @see https://playwright.dev/docs/test-configuration
 */

export default defineConfig({
  // Look for test files in the e2e directory
  testDir: './e2e',
  
  // Run tests in parallel for faster execution
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only (flaky test protection)
  retries: process.env.CI ? 2 : 0,
  
  // Limit workers on CI to avoid resource exhaustion
  workers: process.env.CI ? 2 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    
    // Collect trace on first retry for debugging
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure (helps debug CI issues)
    video: 'on-first-retry',
    
    // Reasonable timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports (critical for Genesis mobile experience)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet viewport
    {
      name: 'iPad',
      use: { ...devices['iPad Pro 11'] },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Output folder for test artifacts
  outputDir: 'test-results/',

  // Preserve output on CI for debugging
  preserveOutput: process.env.CI ? 'always' : 'failures-only',
});

/**
 * e2e/fixtures.ts — Shared Playwright fixtures for Genesis E2E tests.
 *
 * Provides:
 * - `editorPage` fixture: sets localStorage bypass + navigates to /editor
 * - Helper functions for common assertions
 */

import { test as base, expect, type Page } from '@playwright/test';

/**
 * Set up localStorage flags so MainAppGuard allows through in dev mode.
 */
async function setupAuthBypass(page: Page) {
  // Navigate to a blank context first so we can set localStorage on the correct origin
  await page.goto('/', { waitUntil: 'commit' });
  await page.evaluate(() => {
    localStorage.setItem('genesis_e2e_bypass', 'true');
    localStorage.setItem('genesis_onboarding_completed', 'true');
  });
}

/**
 * Clean up localStorage flags after test.
 */
async function teardownAuthBypass(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('genesis_e2e_bypass');
    localStorage.removeItem('genesis_onboarding_completed');
  });
}

// Extended test with editor fixture
export const test = base.extend<{ editorPage: Page }>({
  editorPage: async ({ page }, use) => {
    await setupAuthBypass(page);
    await page.goto('/editor', { waitUntil: 'networkidle' });
    // Wait for React to fully hydrate
    await page.waitForTimeout(1000);
    await use(page);
    await teardownAuthBypass(page);
  },
});

export { expect };
export { setupAuthBypass, teardownAuthBypass };

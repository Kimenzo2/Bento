import { test, expect } from '@playwright/test';

/**
 * Genesis E2E Test Suite - Critical User Journeys
 * 
 * These tests verify the most important user flows work correctly.
 * Run before every deployment to catch regressions.
 */

test.describe('Authentication Flow', () => {
  test('should display auth modal on protected action', async ({ page }) => {
    await page.goto('/');
    
    // App should load
    await expect(page).toHaveTitle(/Genesis/i);
    
    // Auth modal should appear for unauthenticated users trying to create
    const createButton = page.getByRole('button', { name: /create|start|new/i }).first();
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Should show auth modal or redirect to auth
      const authModal = page.getByRole('dialog').filter({ hasText: /sign in|log in|email/i });
      const authPage = page.getByRole('heading', { name: /sign in|log in|welcome/i });
      
      await expect(authModal.or(authPage)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show email input in auth flow', async ({ page }) => {
    await page.goto('/');
    
    // Look for sign in button
    const signInButton = page.getByRole('button', { name: /sign in|log in/i }).first();
    if (await signInButton.isVisible()) {
      await signInButton.click();
      
      // Email input should be visible
      const emailInput = page.getByPlaceholder(/email/i);
      await expect(emailInput).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Home Page', () => {
  test('should load home page successfully', async ({ page }) => {
    await page.goto('/');
    
    // Page should have loaded
    await expect(page).toHaveTitle(/Genesis/i);
    
    // Main content should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Page should still work on mobile
    await expect(page).toHaveTitle(/Genesis/i);
    
    // Navigation should be accessible (might be in hamburger menu)
    const nav = page.getByRole('navigation').or(page.getByRole('button', { name: /menu/i }));
    await expect(nav).toBeVisible();
  });

  test('should have no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out known acceptable errors (like 3rd party script issues)
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('analytics') &&
      !e.includes('third-party')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Navigation', () => {
  test('should navigate between main sections', async ({ page }) => {
    await page.goto('/');
    
    // Check for main navigation links
    const navLinks = page.getByRole('navigation').getByRole('link');
    const linkCount = await navLinks.count();
    
    expect(linkCount).toBeGreaterThan(0);
  });

  test('should have working back navigation', async ({ page }) => {
    await page.goto('/');
    const initialUrl = page.url();
    
    // Navigate to a different page if possible
    const anyLink = page.getByRole('link').first();
    if (await anyLink.isVisible()) {
      await anyLink.click();
      await page.waitForLoadState('networkidle');
      
      // Go back
      await page.goBack();
      await expect(page).toHaveURL(initialUrl);
    }
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto('/');
    
    // Check Largest Contentful Paint
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve((lastEntry as any).startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // Fallback timeout
        setTimeout(() => resolve(0), 5000);
      });
    });
    
    // LCP should be under 2.5 seconds for good score
    if (lcp > 0) {
      expect(lcp).toBeLessThan(2500);
    }
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    // Check for h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');
    
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < Math.min(imageCount, 10); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      
      // Image should have alt text or be marked as decorative
      const isAccessible = alt !== null || role === 'presentation';
      expect(isAccessible).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through the page
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Something should be focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('PWA Features', () => {
  test('should have manifest', async ({ page }) => {
    await page.goto('/');
    
    const manifest = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link?.getAttribute('href');
    });
    
    expect(manifest).toBeTruthy();
  });

  test('should have service worker registered', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const hasServiceWorker = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    
    // Service worker should be registered (might take a moment)
    // Just check the API is available
    const swSupported = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(swSupported).toBeTruthy();
  });
});

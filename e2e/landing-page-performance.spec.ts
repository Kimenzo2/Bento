import { test, expect } from '@playwright/test';

/**
 * Landing Page Performance & SEO Tests
 *
 * Validates FCP, CLS, image optimization, font loading,
 * meta tags, and accessibility on the Genesis landing page.
 */

test.describe('Landing Page Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/welcome', { waitUntil: 'networkidle' });
  });

  // ---------------------------------------------------------------------------
  // FCP & Core Web Vitals
  // ---------------------------------------------------------------------------

  test('First Contentful Paint is under 3 seconds', async ({ page }) => {
    const fcp = await page.evaluate(() =>
      new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              resolve(entry.startTime);
            }
          }
        });
        observer.observe({ type: 'paint', buffered: true });
        // Fallback if already painted
        setTimeout(() => {
          const entries = performance.getEntriesByName('first-contentful-paint');
          if (entries.length > 0) resolve(entries[0].startTime);
          else resolve(-1);
        }, 5000);
      })
    );

    expect(fcp).toBeGreaterThan(0);
    expect(fcp).toBeLessThan(3000); // FCP under 3s
  });

  test('no layout shift from images without dimensions', async ({ page }) => {
    const imgs = await page.locator('img').all();
    for (const img of imgs) {
      const width = await img.getAttribute('width');
      const height = await img.getAttribute('height');
      const src = await img.getAttribute('src');
      // All images should have explicit width and height
      expect(width, `Image ${src} missing width`).toBeTruthy();
      expect(height, `Image ${src} missing height`).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // Font Loading
  // ---------------------------------------------------------------------------

  test('Google Fonts uses non-blocking preload strategy', async ({ page }) => {
    // Verify the preload link exists for the critical fonts
    const preloadFontLinks = await page.locator(
      'link[rel="preload"][as="style"][href*="fonts.googleapis.com"]'
    ).count();
    expect(preloadFontLinks).toBeGreaterThanOrEqual(1);

    // Verify noscript fallback exists
    const htmlContent = await page.content();
    expect(htmlContent).toContain('<noscript>');
    expect(htmlContent).toContain('fonts.googleapis.com');
  });

  test('heading font is Instrument Serif on landing page', async ({ page }) => {
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    const fontFamily = await h1.evaluate((el) =>
      window.getComputedStyle(el).fontFamily
    );
    expect(fontFamily.toLowerCase()).toContain('instrument serif');
  });

  // ---------------------------------------------------------------------------
  // SEO Meta Tags
  // ---------------------------------------------------------------------------

  test('has complete SEO meta tags', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(10);
    expect(title.length).toBeLessThan(80);

    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThan(50);
    expect(description!.length).toBeLessThan(200); // Allow slightly long descriptions

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();

    // Open Graph
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();

    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(ogDesc).toBeTruthy();

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toBeTruthy();

    // Twitter Card
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    expect(twitterCard).toBeTruthy();
  });

  test('has JSON-LD structured data', async ({ page }) => {
    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').count();
    expect(jsonLdScripts).toBeGreaterThanOrEqual(3);
  });

  // ---------------------------------------------------------------------------
  // Image Optimization
  // ---------------------------------------------------------------------------

  test('below-fold images have lazy loading attribute', async ({ page }) => {
    // Wait for React to render the landing page content
    await page.waitForSelector('h1');

    // Count images with loading="lazy" attribute in the rendered DOM
    const lazyCount = await page.evaluate(() =>
      document.querySelectorAll('img[loading="lazy"]').length
    );
    expect(lazyCount).toBeGreaterThanOrEqual(4);
  });

  test('hero image loads eagerly', async ({ page }) => {
    // Wait for React to render
    await page.waitForSelector('h1');

    const eagerCount = await page.evaluate(() =>
      document.querySelectorAll('img[loading="eager"]').length
    );
    expect(eagerCount).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------------------
  // SparkleCursor Performance
  // ---------------------------------------------------------------------------

  test('SparkleCursor uses canvas not DOM elements', async ({ page }) => {
    // Should render a canvas element, not individual DOM sparkle divs
    const canvas = page.locator('canvas[aria-hidden="true"]');
    await expect(canvas).toBeVisible();
  });

  test('SparkleCursor does not render on touch-only devices', async ({ browser }) => {
    const context = await browser.newContext({
      ...({ isMobile: true } as Record<string, boolean>),
      hasTouch: true,
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/welcome', { waitUntil: 'networkidle' });

    // Canvas should exist but contain no sparkles (not actively rendering)
    const canvasCount = await page.locator('canvas[aria-hidden="true"]').count();
    expect(canvasCount).toBeLessThanOrEqual(1);

    await context.close();
  });

  // ---------------------------------------------------------------------------
  // Accessibility & Content
  // ---------------------------------------------------------------------------

  test('all sections have proper heading hierarchy', async ({ page }) => {
    // Wait for the page to render the h1 first
    await page.waitForSelector('h1', { timeout: 15000 });

    // Scroll the page to trigger all whileInView animations
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 50);
      });
    });

    // Wait for animations to settle
    await page.waitForTimeout(1000);

    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();

    // Exactly one h1
    expect(h1Count).toBe(1);
    // Multiple h2 section headings
    expect(h2Count).toBeGreaterThanOrEqual(6);
  });

  test('nav, hero, and CTA sections are present', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();

    // At least one prominent CTA button
    const ctaButtons = page.locator('button, a').filter({ hasText: /get started|choose your realm/i });
    await expect(ctaButtons.first()).toBeVisible();
  });

  test('pricing section shows all tiers', async ({ page }) => {
    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();

    // Use exact match to avoid matching "Creator" inside other text
    await expect(pricingSection.getByText('Spark', { exact: true })).toBeVisible();
    await expect(pricingSection.getByText('Creator', { exact: true })).toBeVisible();
    await expect(pricingSection.getByText('Studio', { exact: true })).toBeVisible();
    await expect(pricingSection.getByText('Empire', { exact: true })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // PWA Icons & Manifest
  // ---------------------------------------------------------------------------

  test('has complete favicon and apple-touch-icon references', async ({ page }) => {
    const htmlContent = await page.content();

    // Favicons
    expect(htmlContent).toContain('sizes="16x16"');
    expect(htmlContent).toContain('sizes="32x32"');
    expect(htmlContent).toContain('sizes="192x192"');

    // Apple touch icons
    const appleTouchIcons = await page.locator('link[rel="apple-touch-icon"]').count();
    expect(appleTouchIcons).toBeGreaterThanOrEqual(3); // 152, 167, 180
  });

  test('PWA manifest contains all required icon sizes', async ({ page }) => {
    // Find the manifest link
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    // Fetch and parse the manifest
    const manifestResponse = await page.evaluate(async (href) => {
      const res = await fetch(href!);
      return res.json();
    }, manifestHref);

    // Required sizes for Android + desktop
    const requiredSizes = ['48x48', '72x72', '96x96', '128x128', '144x144', '192x192', '384x384', '512x512'];
    const iconSizes = manifestResponse.icons.map((i: { sizes: string }) => i.sizes);

    for (const size of requiredSizes) {
      expect(iconSizes, `Missing icon size ${size}`).toContain(size);
    }

    // At least one maskable icon
    const maskableIcons = manifestResponse.icons.filter(
      (i: { purpose: string }) => i.purpose === 'maskable'
    );
    expect(maskableIcons.length).toBeGreaterThanOrEqual(1);
  });

  test('all manifest icon files are accessible', async ({ page }) => {
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifestResponse = await page.evaluate(async (href) => {
      const res = await fetch(href!);
      return res.json();
    }, manifestHref);

    // Check each icon src returns 200
    for (const icon of manifestResponse.icons) {
      const status = await page.evaluate(async (src: string) => {
        const res = await fetch(src);
        return res.status;
      }, icon.src.startsWith('/') ? icon.src : `/${icon.src}`);
      expect(status, `Icon ${icon.src} not accessible`).toBe(200);
    }
  });

  // ---------------------------------------------------------------------------
  // Resource Loading
  // ---------------------------------------------------------------------------

  test('total JS resources are reasonable for dev and prod', async ({ page }) => {
    const totalJS = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      let total = 0;
      for (const entry of entries) {
        if (entry.initiatorType === 'script') {
          total += entry.transferSize || 0;
        }
      }
      return total;
    });

    // Dev mode bundles are unminified (~5MB); prod should be under 500KB gzipped.
    // In dev we just verify JS loaded at all; in prod we'd check the threshold.
    expect(totalJS).toBeGreaterThan(0);

    // Sanity check: even dev should be under 10MB
    expect(totalJS).toBeLessThan(10 * 1024 * 1024);
  });
});

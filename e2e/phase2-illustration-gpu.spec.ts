/**
 * e2e/phase2-illustration-gpu.spec.ts
 *
 * Phase 2 validation for the illustration GPU pipeline:
 * - Safe fallback when WebGPU is unavailable
 * - Lazy-loading behavior for IllustrationGPU chunk
 * - No fatal GPU-related runtime errors during editor boot
 */

import { test, expect, setupAuthBypass } from './fixtures';

test.describe('Phase 2 - Illustration GPU Pipeline', () => {
  test('falls back safely when WebGPU is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: undefined,
      });
    });

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await setupAuthBypass(page);
    await page.goto('/editor', { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toBeVisible();

    const fatalGpuErrors = consoleErrors.filter(
      (e) =>
        e.includes('GPUDevice') ||
        e.includes('GPUTexture') ||
        e.includes('navigator.gpu') ||
        e.includes('is not defined')
    );

    expect(fatalGpuErrors).toHaveLength(0);
  });

  test('does not eagerly load IllustrationGPU chunk on initial editor load', async ({ page }) => {
    const loadedUrls: string[] = [];
    page.on('requestfinished', (request) => {
      loadedUrls.push(request.url());
    });

    await setupAuthBypass(page);
    await page.goto('/editor', { waitUntil: 'networkidle' });

    // Give lazy imports a small window to settle.
    await page.waitForTimeout(1000);

    const gpuChunkLoads = loadedUrls.filter((u) => /IllustrationGPU/i.test(u));
    expect(gpuChunkLoads).toHaveLength(0);
  });

  test('boots editor without fatal IllustrationGPU runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await setupAuthBypass(page);
    await page.goto('/editor', { waitUntil: 'networkidle' });

    const fatalErrors = errors.filter(
      (e) =>
        e.includes('IllustrationGPU') ||
        e.includes('copyExternalImageToTexture') ||
        e.includes('createComputePipeline') ||
        e.includes('WebGPU')
    );

    // Warnings are acceptable, fatal console errors are not.
    expect(fatalErrors).toHaveLength(0);
  });
});

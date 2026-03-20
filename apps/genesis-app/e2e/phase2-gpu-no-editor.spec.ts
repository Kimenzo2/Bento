/**
 * e2e/phase2-gpu-no-editor.spec.ts
 *
 * Phase 2 (non-editor) verification:
 * - App remains stable when WebGPU is unavailable
 * - IllustrationGPU is lazy-split in production output
 * - Initial HTML does not eagerly include the IllustrationGPU chunk
 */

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures';

test.describe('Phase 2 - GPU Pipeline (No Editor)', () => {
  test('home route loads safely with WebGPU disabled', async ({ page }) => {
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

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();

    const fatalGpuErrors = consoleErrors.filter(
      (e) =>
        e.includes('navigator.gpu') ||
        e.includes('GPUDevice') ||
        e.includes('GPUTexture') ||
        e.includes('WebGPU')
    );

    expect(fatalGpuErrors).toHaveLength(0);
  });

  test('initial non-editor navigation does not eagerly load IllustrationGPU chunk', async ({ page }) => {
    const loadedUrls: string[] = [];
    page.on('requestfinished', (request) => {
      loadedUrls.push(request.url());
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const eagerLoads = loadedUrls.filter((u) => /IllustrationGPU/i.test(u));
    expect(eagerLoads).toHaveLength(0);
  });

  test('production build keeps IllustrationGPU as a lazy-split asset', async () => {
    const projectRoot = process.cwd();
    const distDir = path.join(projectRoot, 'dist');
    const assetsDir = path.join(distDir, 'assets');
    const indexHtmlPath = path.join(distDir, 'index.html');

    test.skip(!fs.existsSync(distDir), 'dist folder not found. Run bun run build first.');

    const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
    const gpuChunk = assetFiles.find((f) => /IllustrationGPU-.*\.js$/i.test(f));

    expect(gpuChunk, 'Expected lazy IllustrationGPU chunk in dist/assets').toBeTruthy();

    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const eagerlyReferenced = /IllustrationGPU-.*\.js/i.test(indexHtml);
    expect(eagerlyReferenced).toBeFalsy();
  });
});

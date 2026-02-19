/**
 * Generate OG Image for social media sharing
 * 
 * Usage: npx playwright test scripts/generate-og-image.mjs
 *   OR:  node scripts/generate-og-image.mjs
 * 
 * Outputs: public/og-image.png (1200x630)
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateOGImage() {
  console.log('🎨 Generating OG image...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2, // Retina quality
  });

  const htmlPath = path.resolve(__dirname, 'generate-og-image.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  // Wait for fonts and images to load
  await page.waitForTimeout(2000);

  const outputPath = path.resolve(__dirname, '..', 'public', 'og-image.png');
  await page.screenshot({
    path: outputPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });

  await browser.close();
  console.log(`✅ OG image saved to: ${outputPath}`);
}

generateOGImage().catch((err) => {
  console.error('❌ Failed to generate OG image:', err);
  process.exit(1);
});

/**
 * Performance Budget Checker
 *
 * Validates build output against size budgets.
 * Run after build: bun run size-check
 *
 * Exit codes:
 *   0 = All chunks within budget
 *   1 = One or more chunks exceeded budget
 */

import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist', 'assets');

// Budget in KB (uncompressed)
// Chunks are lazy-loaded unless marked [initial]
const BUDGETS = {
  // ─── Initial Load (critical for FCP/LCP) ───
  index: 350, // [initial] Main app shell
  'rolldown-runtime': 5, // [initial] Bundler runtime

  // ─── Vendor (external dependencies) ───
  'vendor-supabase': 200, // Auth/DB - loaded early
  'vendor-radix': 150, // UI primitives
  'vendor-motion': 150, // Animation
  'vendor-icons': 50, // Lucide icons
  'vendor-i18n': 100, // Internationalization
  'vendor-markdown': 200, // Blog/Learn pages only
  'vendor-flow': 200, // StoryCanvas only
  'vendor-sentry': 500, // Error tracking (async init)

  // ─── Lazy-Loaded Feature Chunks ───
  'vendor-export': 700, // PDF/image export (user action)
  'vendor-email': 1800, // Email rendering (user action)
  'services-ai': 250, // AI services (generation only)
  'server.browser': 200, // React email SSR (with vendor-email)

  // ─── Page Components ───
  MainApp: 100,
  LandingPage: 100,
  OnboardingApp: 50,
  SmartEditor: 250,
  CreationCanvas: 100,
  StorybookViewer: 100,
  SettingsPanel: 100,
};

// Get all JS files
const files = readdirSync(distDir).filter((f) => f.endsWith('.js'));

let failed = false;
const results = [];

for (const file of files) {
  const sizeBytes = statSync(join(distDir, file)).size;
  const sizeKB = sizeBytes / 1024;

  // Find matching budget
  const chunkName = Object.keys(BUDGETS).find((name) => file.includes(name));

  if (chunkName) {
    const budget = BUDGETS[chunkName];
    const status = sizeKB > budget ? '❌' : '✓';
    const percent = ((sizeKB / budget) * 100).toFixed(0);

    results.push({
      file,
      chunk: chunkName,
      size: sizeKB.toFixed(1),
      budget,
      percent,
      exceeded: sizeKB > budget,
    });

    if (sizeKB > budget) {
      failed = true;
    }
  }
}

// Sort by size descending
results.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));

// Output report
console.log('\n📊 Bundle Size Report\n');
console.log('─'.repeat(70));
console.log(
  'Chunk'.padEnd(20),
  'Size (KB)'.padStart(10),
  'Budget'.padStart(10),
  'Usage'.padStart(8),
  'Status'
);
console.log('─'.repeat(70));

for (const r of results) {
  const status = r.exceeded ? '❌ OVER' : '✓ OK';
  console.log(
    r.chunk.padEnd(20),
    r.size.padStart(10),
    String(r.budget).padStart(10),
    `${r.percent}%`.padStart(8),
    status
  );
}

console.log('─'.repeat(70));

// Summary
const totalSize = results.reduce((sum, r) => sum + parseFloat(r.size), 0);
const overBudget = results.filter((r) => r.exceeded);

console.log(`\nTotal tracked: ${totalSize.toFixed(1)} KB`);
console.log(`Chunks over budget: ${overBudget.length}`);

if (failed) {
  console.log('\n⚠️  Some chunks exceeded their budget!');
  console.log('Consider:');
  console.log('  - Dynamic imports for heavy dependencies');
  console.log('  - Code splitting large components');
  console.log('  - Tree-shaking unused exports');
  process.exit(1);
} else {
  console.log('\n✅ All tracked chunks within budget!');
  process.exit(0);
}

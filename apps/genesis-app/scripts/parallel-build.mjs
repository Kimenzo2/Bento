/**
 * parallel-build.mjs
 * Runs `tsgo --noEmit` and `vite build` concurrently for faster CI builds.
 * Falls back to exit code 1 if either process fails.
 *
 * FIXES:
 * - Always builds in production mode unless --dev flag is explicitly passed.
 *   Previously defaulted to development when NODE_ENV was not set, which
 *   caused Vercel preview deployments to ship unminified development bundles.
 * - Removed shell: true from spawn calls. Passing an args array to spawn
 *   does not require shell execution and avoids the Node 22 DEP0190
 *   security deprecation warning about unescaped argument concatenation.
 */
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const start = performance.now();

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    // shell: false (default) — args array is passed directly to the OS,
    // no shell interpolation, no DEP0190 warning, no injection risk.
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: false });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`${label} exited with code ${code}`));
      else resolve();
    });
    proc.on('error', (err) => reject(new Error(`${label}: ${err.message}`)));
  });
}

// Production is the default. Pass --dev explicitly to build in dev mode.
// Never infer development from the absence of an environment variable —
// a missing NODE_ENV should never silently produce a development bundle.
const isDev = process.argv.includes('--dev');
const viteMode = isDev ? 'development' : 'production';

console.log(`\n⚡ Parallel build starting (mode: ${viteMode})...\n`);

try {
  await Promise.all([
    run(
      process.execPath, // node — absolute path, no PATH lookup needed
      ['node_modules/@typescript/native-preview/bin/tsgo.js', '--noEmit', '--incremental'],
      'TypeScript'
    ),
    run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', viteMode], 'Vite'),
  ]);

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Build complete in ${elapsed}s\n`);
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}

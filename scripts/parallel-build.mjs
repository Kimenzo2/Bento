/**
 * parallel-build.mjs
 * Runs `tsc --noEmit` and `vite build` concurrently for ~2x faster CI builds.
 * Falls back to exit code 1 if either process fails.
 */
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const start = performance.now();

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`${label} exited with code ${code}`));
      else resolve();
    });
    proc.on('error', (err) => reject(new Error(`${label}: ${err.message}`)));
  });
}

const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

console.log(`\n⚡ Parallel build starting (mode: ${isProduction ? 'production' : 'development'})...\n`);

try {
  await Promise.all([
    run('npx', ['tsc', '--noEmit', '--incremental'], 'TypeScript'),
    run('npx', ['vite', 'build', ...(isProduction ? ['--mode', 'production'] : [])], 'Vite'),
  ]);
  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Build complete in ${elapsed}s\n`);
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
}

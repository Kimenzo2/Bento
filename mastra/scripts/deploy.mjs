import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '../..');
const projectConfigPath = resolve(rootDir, '.mastra-project.json');

function fail(message) {
  console.error(`[mastra deploy] ${message}`);
  process.exit(1);
}

async function main() {
  const target = process.argv[2];
  if (target !== 'server' && target !== 'studio') {
    fail('Usage: node scripts/deploy.mjs <server|studio>');
  }

  if (!process.env.MASTRA_API_TOKEN) {
    fail('MASTRA_API_TOKEN is required for deployment.');
  }

  const config = JSON.parse(await readFile(projectConfigPath, 'utf8'));
  const orgId = process.env.MASTRA_ORG_ID || config.organizationId;
  const projectId = process.env.MASTRA_PROJECT_ID || config.projectId;

  if (!orgId || !projectId) {
    fail('Missing organization or project id.');
  }

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      'bunx',
      ['mastra', target, 'deploy', '--skip-build', '--yes', '--org', orgId, '--project', projectId],
      {
        cwd: rootDir,
        env: process.env,
        stdio: 'inherit',
        shell: false,
      }
    );

    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`Deployment interrupted by signal ${signal}.`));
        return;
      }

      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`Deployment exited with code ${code}.`));
    });
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

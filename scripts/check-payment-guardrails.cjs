#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const vercelPath = path.join(root, 'vercel.json');
const dodoApiPath = path.join(root, 'api', 'dodo.ts');
const packageJsonPath = path.join(root, 'package.json');

const requiredRewrites = [
  { source: '/api/dodo-checkout/', destination: '/api/dodo?action=checkout' },
  { source: '/api/dodo-checkout', destination: '/api/dodo?action=checkout' },
  { source: '/api/dodo-webhook/', destination: '/api/dodo?action=webhook' },
  { source: '/api/dodo-webhook', destination: '/api/dodo?action=webhook' },
];

const requiredRootDeps = ['@supabase/supabase-js', 'dodopayments', 'jose'];

const failures = [];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

try {
  if (!fs.existsSync(vercelPath)) {
    failures.push('Missing vercel.json.');
  } else {
    const vercel = readJson(vercelPath);

    if (vercel.trailingSlash !== false) {
      failures.push('vercel.json must keep trailingSlash set to false.');
    }

    const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];

    for (const expected of requiredRewrites) {
      const found = rewrites.some(
        (entry) =>
          entry &&
          entry.source === expected.source &&
          entry.destination === expected.destination
      );

      if (!found) {
        failures.push(
          `Missing required rewrite: ${expected.source} -> ${expected.destination}`
        );
      }
    }
  }

  if (!fs.existsSync(dodoApiPath)) {
    failures.push('Missing api/dodo.ts.');
  } else {
    const dodoApi = fs.readFileSync(dodoApiPath, 'utf8');

    if (!dodoApi.includes('bodyParser: false')) {
      failures.push('api/dodo.ts must keep bodyParser set to false.');
    }

    if (dodoApi.includes('_middleware')) {
      failures.push('api/dodo.ts must not reference _middleware.');
    }
  }

  if (!fs.existsSync(packageJsonPath)) {
    failures.push('Missing package.json.');
  } else {
    const pkg = readJson(packageJsonPath);
    const deps = pkg.dependencies || {};

    for (const dep of requiredRootDeps) {
      if (!deps[dep]) {
        failures.push(`Root package.json is missing required runtime dependency: ${dep}`);
      }
    }
  }
} catch (error) {
  failures.push(`Guardrail check crashed: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length > 0) {
  console.error('\n[guardrails] Payment safety checks failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error('\nRef: AGENTS.md payment lock rules.\n');
  process.exit(1);
}

console.log('[guardrails] Payment safety checks passed.');

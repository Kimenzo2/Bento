const fs = require('node:fs');
const path = require('node:path');

const sourceDir = path.join(process.cwd(), 'apps', 'genesis-app', 'dist');
const targetDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(sourceDir)) {
  console.error(`[sync-root-dist] Source directory not found: ${sourceDir}`);
  process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });

console.log(`[sync-root-dist] Copied ${sourceDir} -> ${targetDir}`);

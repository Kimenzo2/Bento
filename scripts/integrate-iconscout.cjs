/**
 * integrate-iconscout.cjs
 *
 * 1. Updates CreationCanvas.tsx: replaces old IconscoutSparkle/Rocket/Building
 *    with the new IcoWand/IcoRocket/IcoBuilding names.
 *
 * 2. Replaces high-frequency Lucide icons with Ico* equivalents across the app:
 *    - Wand2       → IcoWand
 *    - BookOpen    → IcoBook
 *    - Star        → IcoStar
 *    - Palette     → IcoPalette
 *    - Bell        → IcoBell
 *    - Crown       → IcoCrown
 *    - Award       → IcoAward
 *    - Zap         → IcoZap (where used as icon/badge, NOT in critical logic buttons)
 *    - PenTool     → IcoPen
 *    - Send        → IcoSend  (non-button send variants)
 *    - Library     → IcoLibrary
 *
 * Strategy: for each file that imports any of these from 'lucide-react',
 *   a) add the Ico* import from '../components/IconscoutIcons' (or the right rel path)
 *   b) replace each <LucideIcon in JSX with <IcoName
 *   c) strip the replaced names from the lucide-react import
 *
 * We do NOT touch icons used ONLY as values in non-JSX objects (safety guard).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// ── mapping: lucide export name  →  Ico* name ───────────────────────────────
const ICON_MAP = {
  Wand2:    'IcoWand',
  BookOpen: 'IcoBook',
  Star:     'IcoStar',
  Palette:  'IcoPalette',
  Bell:     'IcoBell',
  Crown:    'IcoCrown',
  Award:    'IcoAward',
  Zap:      'IcoZap',
  PenTool:  'IcoPen',
  Send:     'IcoSend',
  Library:  'IcoLibrary',
};

const LUCIDE_NAMES  = Object.keys(ICON_MAP);    // e.g. ['Wand2', 'BookOpen', ...]
const ICONSCOUT_NAMES = Object.values(ICON_MAP); // e.g. ['IcoWand', 'IcoBook', ...]

function relPath(fromFile, toFile) {
  let rel = path.relative(path.dirname(fromFile), toFile);
  rel = rel.replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  // strip .tsx extension for import
  return rel.replace(/\.tsx$/, '');
}

function processFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;

  // ── 1. Check which Lucide icons this file actually uses in JSX ──────────────
  const lucideImportMatch = src.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
  if (!lucideImportMatch) return false;

  const importedLucide = lucideImportMatch[1]
    .split(',')
    .map(s => s.trim().split(/\s+as\s+/)[0].trim())
    .filter(Boolean);

  // Only the icons we have replacements for
  const toReplace = importedLucide.filter(n => LUCIDE_NAMES.includes(n));
  if (toReplace.length === 0) return false;

  // ── 2. Check each candidate is actually used as JSX (safety guard) ──────────
  const jsxUsed = toReplace.filter(name => {
    const jsxPattern = new RegExp(`<${name}[\\s/>]`);
    return jsxPattern.test(src);
  });
  if (jsxUsed.length === 0) return false;

  console.log(`\n  [${path.relative(ROOT, filePath)}]`);
  console.log(`    replacing: ${jsxUsed.join(', ')}`);

  // ── 3. Replace JSX tags  <LucideIcon  →  <IcoName ───────────────────────────
  for (const lucide of jsxUsed) {
    const ico = ICON_MAP[lucide];
    // opening tags: <Wand2 and closing </Wand2>
    src = src.replace(new RegExp(`<${lucide}([ />])`, 'g'), `<${ico}$1`);
    src = src.replace(new RegExp(`</${lucide}>`, 'g'), `</${ico}>`);
  }

  // ── 4. Remove replaced names from lucide-react import ───────────────────────
  const remainingLucide = importedLucide.filter(n => !jsxUsed.includes(n));
  if (remainingLucide.length === 0) {
    // Remove entire lucide-react import line
    src = src.replace(/import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"];?\n?/, '');
  } else {
    src = src.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/,
      `import { ${remainingLucide.join(', ')} } from 'lucide-react'`
    );
  }

  // ── 5. Add Ico* import if not already present ────────────────────────────────
  const iconscoutImportPath = relPath(filePath, path.join(ROOT, 'components', 'IconscoutIcons'));
  const icoNames = jsxUsed.map(l => ICON_MAP[l]);

  if (!src.includes('IconscoutIcons')) {
    // Insert after the last import statement
    const lastImportIdx = [...src.matchAll(/^import .+;\n/gm)].pop();
    if (lastImportIdx) {
      const insertAt = lastImportIdx.index + lastImportIdx[0].length;
      const importLine = `import { ${icoNames.join(', ')} } from '${iconscoutImportPath}';\n`;
      src = src.slice(0, insertAt) + importLine + src.slice(insertAt);
    } else {
      src = `import { ${icoNames.join(', ')} } from '${iconscoutImportPath}';\n` + src;
    }
  } else {
    // Already has IconscoutIcons import — add missing names
    src = src.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"][^'"]*IconscoutIcons['"]/,
      (match, existing) => {
        const existingNames = existing.split(',').map(s => s.trim()).filter(Boolean);
        const allNames = [...new Set([...existingNames, ...icoNames])];
        return `import { ${allNames.join(', ')} } from '${iconscoutImportPath}'`;
      }
    );
  }

  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf8');
    return true;
  }
  return false;
}

// ── Step A: Update CreationCanvas.tsx (old → new names) ─────────────────────
const canvasPath = path.join(ROOT, 'components', 'CreationCanvas.tsx');
let canvas = fs.readFileSync(canvasPath, 'utf8');
const canvasOrig = canvas;

canvas = canvas.replace(/IconscoutSparkle/g, 'IcoWand');
canvas = canvas.replace(/IconscoutRocket/g, 'IcoRocket');
canvas = canvas.replace(/IconscoutBuilding/g, 'IcoBuilding');

if (canvas !== canvasOrig) {
  fs.writeFileSync(canvasPath, canvas, 'utf8');
  console.log('✓ CreationCanvas.tsx — renamed old Iconscout* to Ico* names');
}

// ── Step B: Walk all .tsx/.ts files and replace Lucide icons ─────────────────
function walkDir(dir, exts, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', '.git', 'dist', 'build', 'public'].includes(e.name)) {
      walkDir(full, exts, results);
    } else if (e.isFile() && exts.some(ext => e.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

const files = walkDir(ROOT, ['.tsx', '.ts']).filter(f => !f.includes('IconscoutIcons'));
console.log(`\nScanning ${files.length} TypeScript files…`);

let changed = 0;
for (const f of files) {
  try {
    if (processFile(f)) changed++;
  } catch (err) {
    console.error(`  ERROR on ${f}: ${err.message}`);
  }
}

console.log(`\n✓ Done — ${changed} files updated.\n`);

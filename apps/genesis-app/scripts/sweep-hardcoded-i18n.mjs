import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanRoots = [path.join(root, 'pages'), path.join(root, 'components')];

const includeExt = new Set(['.tsx', '.ts']);
const excludeParts = [
  '/ui/',
  '.test.',
  '.spec.',
  '/node_modules/',
  '/dist/',
  '/.turbo/',
  '/pages/legal/',
];

const results = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }

    const ext = path.extname(full);
    if (!includeExt.has(ext)) continue;

    const normalized = full.replace(/\\/g, '/');
    if (excludeParts.some((p) => normalized.includes(p))) continue;

    const text = readFileSync(full, 'utf8');
    const lines = text.split(/\r?\n/);
    let inTemplateLiteral = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip large embedded markdown/text template blocks
      const backtickCount = (line.match(/`/g) || []).length;
      if (backtickCount % 2 === 1) inTemplateLiteral = !inTemplateLiteral;
      if (inTemplateLiteral) continue;

      // JSX text between tags on same line
      const jsxMatches = [...line.matchAll(/>([^<>{}][^<>{}]*)</g)];
      for (const m of jsxMatches) {
        const value = m[1].trim();
        if (!value) continue;
        if (!/[A-Za-z]/.test(value)) continue;
        if (value.length < 3 || value.length > 60) continue;
        const words = value.split(/\s+/).filter(Boolean);
        if (words.length > 8) continue;
        if (/[.:;!?]/.test(value)) continue;
        if (/\bhttps?:\/\/|@|\d{4,}\b/.test(value)) continue;
        results.push({ file: normalized, line: i + 1, kind: 'jsx-text', value });
      }

      // Hardcoded attribute strings likely user-visible
      const attrMatches = [...line.matchAll(/\b(placeholder|title|aria-label|alt)=\"([^\"]+)\"/g)];
      for (const m of attrMatches) {
        const value = m[2].trim();
        if (!value || value.length < 3) continue;
        if (!/[A-Za-z]/.test(value)) continue;
        if (/\bhttps?:\/\/|@|\d{4,}\b/.test(value)) continue;
        if (value === 'Genesis' || value === 'Go back') continue;
        results.push({ file: normalized, line: i + 1, kind: m[1], value });
      }
    }
  }
}

for (const dir of scanRoots) {
  walk(dir);
}

const grouped = new Map();
for (const r of results) {
  const rel = path.relative(root, r.file).replace(/\\/g, '/');
  if (!grouped.has(rel)) grouped.set(rel, []);
  grouped.get(rel).push(r);
}

let out = '# i18n Hardcoded String Sweep\n\n';
out += `Generated: ${new Date().toISOString()}\n\n`;
out += `Total findings: ${results.length}\n\n`;

for (const [file, items] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
  out += `## ${file} (${items.length})\n`;
  for (const it of items.slice(0, 40)) {
    out += `- L${it.line} [${it.kind}] ${it.value}\n`;
  }
  if (items.length > 40) {
    out += `- ... and ${items.length - 40} more\n`;
  }
  out += '\n';
}

const reportPath = path.join(root, 'i18n-sweep-report.md');
writeFileSync(reportPath, out, 'utf8');
console.log(`i18n sweep complete: ${results.length} findings`);
console.log(`report: ${reportPath}`);

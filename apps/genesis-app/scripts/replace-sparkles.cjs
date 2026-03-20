const fs = require('fs');
const path = require('path');

// Context-based replacement rules
function pickReplacement(filePath, lineIndex, lines) {
  const rel = filePath.replace(/\\/g, '/').toLowerCase();
  const ctx = lines.slice(Math.max(0, lineIndex - 4), lineIndex + 4).join(' ').toLowerCase();

  // File-level overrides
  if (rel.includes('whatsne')) return 'Zap';
  if (rel.includes('booksuccess')) return 'Award';
  if (rel.includes('welcomehero')) return 'Crown';
  if (rel.includes('welcomesuccess')) return 'Crown';
  if (rel.includes('infographicresult')) return 'Award';
  if (rel.includes('sharedbookviewer')) return 'PenTool';
  if (rel.includes('generationloading')) return 'Wand2';

  // Line-context overrides
  if (ctx.includes('publish')) return 'Send';
  if (ctx.includes('fun fact')) return 'Lightbulb';
  if (ctx.includes('tips to improve') || (ctx.includes('tips') && ctx.includes('improve'))) return 'Lightbulb';
  if (ctx.includes('my library')) return 'Library';
  if (ctx.includes('challenge_new')) return 'Zap';
  if (ctx.includes('remix') && ctx.includes('notification')) return 'GitFork';
  if (ctx.includes('masterpiece')) return 'Award';
  if (ctx.includes('setting up')) return 'Loader2';

  return 'Wand2';
}

function getFiles(dir) {
  let r = [];
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', 'scripts'].includes(f)) continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) r = r.concat(getFiles(p));
    else if ((f.endsWith('.tsx') || f.endsWith('.ts')) && f !== 'SparkleCursor.tsx') r.push(p);
  }
  return r;
}

const ROOT = 'C:/Users/admin/Downloads/Genesis';
const files = getFiles(ROOT);
let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('Sparkles')) continue;

  const lines = content.split('\n');
  const replacementsNeeded = new Set();

  // Collect all needed replacements
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<Sparkles')) {
      replacementsNeeded.add(pickReplacement(file, i, lines));
    }
  }

  // Replace JSX occurrences
  const newLines = lines.map((line, i) => {
    if (!line.includes('<Sparkles')) return line;
    const rep = pickReplacement(file, i, lines);
    totalChanges++;
    return line.replace(/<Sparkles\b/g, '<' + rep);
  });

  let newContent = newLines.join('\n');

  // Remove Sparkles from lucide-react import
  newContent = newContent.replace(/,\s*Sparkles\b/g, '');
  newContent = newContent.replace(/\bSparkles\s*,\s*/g, '');
  newContent = newContent.replace(/\{\s*Sparkles\s*\}/g, '{}');

  // Add missing icon imports to the lucide-react import line
  for (const icon of replacementsNeeded) {
    const alreadyImported = new RegExp('\\b' + icon + '\\b').test(
      (newContent.match(/import\s*\{[^}]+\}\s*from\s*'lucide-react'/) || [''])[0]
    );
    if (!alreadyImported) {
      newContent = newContent.replace(
        /import\s*\{([^}]+)\}\s*from\s*'lucide-react'/,
        (m, inner) => 'import {' + inner.trimEnd().replace(/,\s*$/, '') + ', ' + icon + ' } from \'lucide-react\''
      );
    }
  }

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    const rel = file.replace(ROOT + '/', '').replace(ROOT.replace(/\//g, '\\') + '\\', '');
    console.log('OK  ' + rel + '  =>  [' + [...replacementsNeeded].join(', ') + ']');
  }
}

console.log('\nTOTAL JSX replacements: ' + totalChanges);

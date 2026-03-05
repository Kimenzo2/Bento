const fs = require('fs');
const path = require('path');

const ALL_REPLACEMENTS = ['Wand2','Crown','Award','Send','Library','Lightbulb','PenTool','GitFork','Loader2','Zap'];

function getFiles(dir) {
  let r = [];
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(f)) continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) r = r.concat(getFiles(p));
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) r.push(p);
  }
  return r;
}

const ROOT = 'C:/Users/admin/Downloads/Genesis';
const files = getFiles(ROOT);
let fixCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Check for empty or near-empty lucide import
  const hasEmptyImport = /import\s*\{\s*\}\s*from\s*'lucide-react'/.test(content);
  if (!hasEmptyImport) continue;

  // Find which replacement icons are actually used in JSX in this file
  const needed = new Set();
  const lines = content.split('\n');
  for (const line of lines) {
    for (const icon of ALL_REPLACEMENTS) {
      if (new RegExp('<' + icon + '[^a-zA-Z]').test(line)) {
        needed.add(icon);
      }
    }
  }

  const rel = file.replace('C:/Users/admin/Downloads/Genesis/', '').replace(/\\/g, '/');

  if (needed.size === 0) {
    // No icons needed - remove the empty import entirely
    content = content.replace(/import\s*\{\s*\}\s*from\s*'lucide-react';\n?/g, '');
    fs.writeFileSync(file, content, 'utf8');
    console.log('REMOVED empty import: ' + rel);
    fixCount++;
    continue;
  }

  // Replace empty import with proper import
  const iconList = [...needed].sort().join(',\n  ');
  content = content.replace(
    /import\s*\{\s*\}\s*from\s*'lucide-react'/,
    'import {\n  ' + iconList + '\n} from \'lucide-react\''
  );
  fs.writeFileSync(file, content, 'utf8');
  console.log('FIXED: ' + rel + ' => [' + [...needed].join(', ') + ']');
  fixCount++;
}

console.log('\nTotal fixed: ' + fixCount);

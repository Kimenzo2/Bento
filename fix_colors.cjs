const fs = require('fs');
const path = require('path');

const walkSync = (dir, callback) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (!p.includes('node_modules') && !p.endsWith('ui')) {
        walkSync(p, callback);
      }
    } else {
      if (p.endsWith('.tsx') || p.endsWith('.ts') || p.endsWith('.jsx')) {
        callback(p);
      }
    }
  }
};

walkSync('./components', (filePath) => {
  let cnt = fs.readFileSync(filePath, 'utf8');
  let orig = cnt;
  
  cnt = cnt.replace(/\bbg-white\b/g, 'bg-surface');
  cnt = cnt.replace(/\bbg-gray-50\b/g, 'bg-surface/50');
  cnt = cnt.replace(/\bbg-gray-100\b/g, 'bg-peach-soft/30');
  cnt = cnt.replace(/\bbg-gray-200\b/g, 'bg-peach-light/50');
  cnt = cnt.replace(/\bhover:bg-gray-50\b/g, 'hover:bg-surface/50');
  cnt = cnt.replace(/\bhover:bg-gray-100\b/g, 'hover:bg-peach-soft/30');
  
  cnt = cnt.replace(/\bborder-gray-200\b/g, 'border-peach-soft');
  cnt = cnt.replace(/\bborder-gray-100\b/g, 'border-peach-soft/50');
  cnt = cnt.replace(/\bborder-gray-300\b/g, 'border-peach-soft');
  
  cnt = cnt.replace(/\btext-gray-900\b/g, 'text-charcoal-soft');
  cnt = cnt.replace(/\btext-gray-800\b/g, 'text-charcoal-soft');
  cnt = cnt.replace(/\btext-gray-700\b/g, 'text-cocoa-light');
  cnt = cnt.replace(/\btext-gray-600\b/g, 'text-cocoa-light');
  cnt = cnt.replace(/\btext-gray-500\b/g, 'text-cocoa-light');
  cnt = cnt.replace(/\btext-gray-400\b/g, 'text-cocoa-light/60');
  cnt = cnt.replace(/\btext-gray-300\b/g, 'text-cocoa-light/60');
  cnt = cnt.replace(/\btext-gray-200\b/g, 'text-surface');
  cnt = cnt.replace(/\btext-gray-100\b/g, 'text-surface');
  cnt = cnt.replace(/\btext-gray-50\b/g, 'text-surface');
  
  cnt = cnt.replace(/\btext-black\b/g, 'text-charcoal-soft');
  
  cnt = cnt.replace(/\bdark:bg-gray-[0-9]+\b/g, '');
  cnt = cnt.replace(/\bdark:border-gray-[0-9]+\b/g, '');
  cnt = cnt.replace(/\bdark:text-gray-[0-9]+\b/g, '');
  cnt = cnt.replace(/\bdark:text-white\b/g, '');
  cnt = cnt.replace(/\bdark:hover:bg-gray-[0-9]+\b/g, '');
  cnt = cnt.replace(/\bdark:hover:text-white\b/g, '');

  if (cnt !== orig) {
    fs.writeFileSync(filePath, cnt, 'utf8');
  }
});
console.log('Fixed Tailwind colors!');

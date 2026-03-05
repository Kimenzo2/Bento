const fs = require('fs');
const path = require('path');

const walkSync = (dir, callback) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      if (!p.includes('node_modules') && !p.endsWith('ui')) walkSync(p, callback);
    } else {
      if (p.endsWith('.tsx')) callback(p);
    }
  }
};

walkSync('./components', (filePath) => {
  let cnt = fs.readFileSync(filePath, 'utf8');
  let orig = cnt;
  
  cnt = cnt.replace(/\bbg-gray-[89]00\b/g, 'bg-surface');
  cnt = cnt.replace(/\bbg-gray-[67]00\b/g, 'bg-peach-soft/20');
  cnt = cnt.replace(/\bbg-gray-[345]00\b/g, 'bg-peach-soft/50');
  cnt = cnt.replace(/\bhover:bg-gray-[89]00\b/g, 'hover:bg-peach-soft/10');
  cnt = cnt.replace(/\bhover:bg-gray-[67]00\b/g, 'hover:bg-peach-soft/30');
  cnt = cnt.replace(/\bhover:bg-gray-[345]00\b/g, 'hover:bg-peach-soft/50');
  
  cnt = cnt.replace(/\btext-black\b/g, 'text-charcoal-soft');
  
  if (cnt !== orig) fs.writeFileSync(filePath, cnt, 'utf8');
});

console.log('Fixed rest.');

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
  
  cnt = cnt.replace(/\bborder-gray-[0-9]+\b/g, 'border-white/10');
  cnt = cnt.replace(/\bring-gray-[0-9]+\b/g, 'ring-white/20');
  cnt = cnt.replace(/\bdivide-gray-[0-9]+\b/g, 'divide-white/10');
  cnt = cnt.replace(/\bplaceholder-gray-[0-9]+\b/g, 'placeholder-white/40');
  cnt = cnt.replace(/\btext-gray-[0-9]+\b/g, 'text-cocoa-light');
  
  if (cnt !== orig) fs.writeFileSync(filePath, cnt, 'utf8');
});

console.log('Fixed borders and remaining grays (safe).');    

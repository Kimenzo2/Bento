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
  
  cnt = cnt.replace(/\s+dark:bg-gray-[0-9]+/g, '');
  cnt = cnt.replace(/\s+dark:hover:bg-gray-[0-9]+/g, '');
  cnt = cnt.replace(/\s+dark:border-white\/10/g, '');
  cnt = cnt.replace(/\s+dark:text-white/g, '');
  cnt = cnt.replace(/\s+dark:text-cocoa-light\/60/g, '');
  
  // there's a ternary using 'bg-gray-300 dark:bg-gray-600'
  cnt = cnt.replace(/'bg-gray-300 dark:bg-gray-600'/g, "'bg-peach-soft/50'");
  // replace the remaining bg-gray-300
  cnt = cnt.replace(/'bg-gray-300'/g, "'bg-peach-soft/50'");
  
  if (cnt !== orig) {
    fs.writeFileSync(filePath, cnt, 'utf8');
    console.log('Cleaned dark: classes in ' + filePath);
  }
});

const fs = require('fs');
const path = require('path');

const walkSync = (dir, callback) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      if (!p.includes('node_modules')) walkSync(p, callback);
    } else {
      if (p.endsWith('.tsx')) callback(p);
    }
  }
};

['.', './components', './src'].forEach(d => {
  if (fs.existsSync(d)) {
    walkSync(d, filePath => {
      let cnt = fs.readFileSync(filePath, 'utf8');
      let orig = cnt;
      cnt = cnt.replace(/\bbackdrop-blur-[a-zA-Z0-9-]+\b/g, '');
      cnt = cnt.replace(/\bbackdrop-blur\b/g, '');
      if (cnt !== orig) fs.writeFileSync(filePath, cnt, 'utf8');
    });
  }
});

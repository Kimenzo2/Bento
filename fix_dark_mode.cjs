const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory && !dirPath.includes('node_modules') && !dirPath.includes('ui\\') && !dirPath.includes('ui/')) {
      walkDir(dirPath, callback);
    } else if (!isDirectory && dirPath.endsWith('.tsx') && !dirPath.includes('node_modules') && !dirPath.includes('ui\\') && !dirPath.includes('ui/')) {
      callback(dirPath);
    }
  });
}

const patterns = [
  /dark:bg-gray-[0-9]+/g,
  /dark:border-gray-[0-9]+/g,
  /dark:text-gray-[0-9]+/g,
  /dark:text-white\b/g,
  /dark:hover:bg-gray-[0-9]+/g,
  /dark:hover:text-white\b/g,
  /dark:bg-surface\b/g,
  /dark:bg-cream-[a-z]+/g
];

walkDir('./components', function(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  patterns.forEach(p => {
    content = content.replace(p, '');
  });
  
  content = content.replace(/[ ]{2,}(?=[a-zA-Z])/g, ' ');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
console.log('Done.');

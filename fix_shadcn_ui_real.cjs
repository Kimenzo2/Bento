const fs = require('fs');

let btnPath = './components/ui/button.tsx';
let btnCnt = fs.readFileSync(btnPath, 'utf8');

// safely append to string by splitting by colon and targeting exact lines
let lines = btnCnt.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('default:') && lines[i+1]) {
    if (!lines[i+1].includes('dark:')) lines[i+1] = lines[i+1].replace('",', ' dark:bg-white dark:text-black dark:border-white/20 dark:hover:bg-white/90",');
  }
  if (lines[i].includes('primary:') && lines[i+1]) {
    if (!lines[i+1].includes('dark:')) lines[i+1] = lines[i+1].replace('",', ' dark:text-white",');
  }
  if (lines[i].includes('outline:') && lines[i+1]) {
    if (!lines[i+1].includes('dark:')) lines[i+1] = lines[i+1].replace('",', ' dark:bg-transparent dark:text-white dark:border-white/20 dark:hover:bg-white/10",');
  }
  if (lines[i].includes('secondary:') && lines[i+1]) {
    if (!lines[i+1].includes('dark:')) lines[i+1] = lines[i+1].replace('",', ' dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/20",');
  }
  if (lines[i].includes('ghost:') && lines[i+1]) {
    if (!lines[i+1].includes('dark:')) lines[i+1] = lines[i+1].replace('",', ' dark:text-white dark:hover:bg-white/10",');
  }
}
fs.writeFileSync(btnPath, lines.join('\n'), 'utf8');

let badgePath = './components/ui/badge.tsx';
if (fs.existsSync(badgePath)) {
  let blines = fs.readFileSync(badgePath, 'utf8').split('\n');
  for (let i = 0; i < blines.length; i++) {
    if (blines[i].includes('default:') && blines[i+1]) {
      if (!blines[i+1].includes('dark:')) blines[i+1] = blines[i+1].replace('",', ' dark:bg-white dark:text-black dark:border-white/20 dark:hover:bg-white/90",');
    }
    if (blines[i].includes('secondary:') && blines[i+1]) {
      if (!blines[i+1].includes('dark:')) blines[i+1] = blines[i+1].replace('",', ' dark:bg-white/10 dark:text-white dark:hover:bg-white/20",');
    }
    if (blines[i].includes('outline:') && blines[i+1]) {
      if (!blines[i+1].includes('dark:')) blines[i+1] = blines[i+1].replace('",', ' dark:text-white dark:border-white/20",');
    }
  }
  fs.writeFileSync(badgePath, blines.join('\n'), 'utf8');
}
console.log('Fixed UI safey.');

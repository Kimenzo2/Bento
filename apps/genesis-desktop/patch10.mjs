import { readFileSync, writeFileSync } from 'fs';

const path =
  'C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\modules\\tasks\\App.svelte';
let src = readFileSync(path, 'utf8');
const orig = src;

// Fix 1: Today button
src = src.replace(
  `                const d = time.dayStart(time.now()) + time.DAY - 1000;\r\n                setDueDate(d.getTime());`,
  `                setDueDate(time.dayStart(time.now()) + time.DAY - 1000);`
);

// Fix 2: Tomorrow button
src = src.replace(
  `                const d = time.dayStart(time.now()) + 2 * time.DAY - 1000;\r\n                setDueDate(d.getTime());`,
  `                setDueDate(time.dayStart(time.now()) + 2 * time.DAY - 1000);`
);

// Fix 3: Next Week button
src = src.replace(
  `                const d = time.dayStart(time.now()) + 8 * time.DAY - 1000;\r\n                setDueDate(d.getTime());`,
  `                setDueDate(time.dayStart(time.now()) + 8 * time.DAY - 1000);`
);

if (src !== orig) {
  writeFileSync(path, src, 'utf8');
  console.log('✅ All 3 fixes applied successfully.');
} else {
  console.log('⚠️  No changes made.');
}

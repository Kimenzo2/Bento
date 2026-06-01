/**
 * patch7.mjs — Fix remaining `new Date()` in tasks/App.svelte using exact line content
 */
import { readFileSync, writeFileSync } from 'fs';

const filePath =
  'C:/Users/admin/Downloads/Genesis/apps/genesis-desktop/src/modules/tasks/App.svelte';
let content = readFileSync(filePath, 'utf-8');
const original = content;

// Replace using indexOf to ensure we only touch current-time Date()
// Each replacement: { from: unique substring, to: replacement }

const replacements = [
  {
    from: `    const d = new Date();\r\n    d.setHours(0, 0, 0, 0);\r\n    return d;\r\n  });\r\n\r\n  // BUG-14 FIX: calendarMonth/Year must also follow today — init from live today\r\n  let calendarMonth = $state(new Date().getMonth());\r\n  let calendarYear  = $state(new Date().getFullYear());`,
    to: `    const nowMs = time.now();\r\n    return new Date(time.dayStart(nowMs));\r\n  });\r\n\r\n  // BUG-14 FIX: calendarMonth/Year must also follow today — init from live today\r\n  let calendarMonth = $state(time.getDate(time.now()).month - 1);\r\n  let calendarYear  = $state(time.getDate(time.now()).year);`,
  },
];

let count = 0;
for (const r of replacements) {
  if (content.includes(r.from)) {
    content = content.replace(r.from, r.to);
    count++;
  } else {
    console.log('Not found (trying without \\r): ' + r.from.substring(0, 60).replace(/\r/g, '\\r'));
    // Try without \r
    const noCr = r.from.replace(/\r\n/g, '\n');
    if (content.includes(noCr)) {
      content = content.replace(noCr, r.to.replace(/\r\n/g, '\n'));
      count++;
      console.log('  ✓ Found without \\r');
    }
  }
}

if (content !== original) {
  writeFileSync(filePath, content, 'utf-8');
  console.log(`\n✅ Applied ${count} replacements`);
} else {
  console.log(`\n⚠️ No changes made`);
}

// Print new Date() count
const matches = content.match(/new Date\(\)/g);
console.log(`Remaining new Date(): ${matches ? matches.length : 0}`);

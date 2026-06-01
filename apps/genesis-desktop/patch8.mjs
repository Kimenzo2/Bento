/**
 * patch8.mjs — Fix ALL remaining `new Date()` for current time in tasks/App.svelte
 */
import { readFileSync, writeFileSync } from 'fs';

const filePath =
  'C:/Users/admin/Downloads/Genesis/apps/genesis-desktop/src/modules/tasks/App.svelte';
let content = readFileSync(filePath, 'utf-8');
const original = content;

// Check if we're dealing with \r\n or \n
const hasCR = content.includes('\r\n');
const NL = hasCR ? '\r\n' : '\n';

function esc(str) {
  return str.replace(/\r?\n/g, NL);
}

const replacements = [
  // 1. today derived block + calendarMonth/Year init
  {
    from: esc(
      `    const d = new Date();\n    d.setHours(0, 0, 0, 0);\n    return d;\n  });\n\n  // BUG-14 FIX: calendarMonth/Year must also follow today — init from live today\n  let calendarMonth = $state(new Date().getMonth());\n  let calendarYear  = $state(new Date().getFullYear());`
    ),
    to: esc(
      `    const nowMs = time.now();\n    return new Date(time.dayStart(nowMs));\n  });\n\n  // BUG-14 FIX: calendarMonth/Year must also follow today — init from live today\n  let calendarMonth = $state(time.getDate(time.now()).month - 1);\n  let calendarYear  = $state(time.getDate(time.now()).year);`
    ),
  },

  // 2. scheduleMidnightFlip — const now = new Date();
  {
    from: esc(
      `      const now = new Date();\n      const msUntilMidnight =\n        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();`
    ),
    to: esc(
      `      const nowMs = time.now();\n      const now = new Date(nowMs);\n      const msUntilMidnight =\n        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - nowMs;`
    ),
  },

  // 3. scheduleMidnightFlip — const tomorrow = new Date();
  {
    from: esc(
      `        const tomorrow = new Date();\n        calendarMonth = tomorrow.getMonth();\n        calendarYear  = tomorrow.getFullYear();`
    ),
    to: esc(
      `        const tomorrow = new Date(time.now());\n        calendarMonth = tomorrow.getMonth();\n        calendarYear  = tomorrow.getFullYear();`
    ),
  },

  // 4. addContextDefaults — endOfDay
  {
    from: esc(
      `    const endOfDay = (offsetDays: number) => {\n      const d = new Date();\n      d.setDate(d.getDate() + offsetDays);\n      d.setHours(23, 59, 59, 999);\n      return d.getTime();\n    };`
    ),
    to: esc(
      `    const endOfDay = (offsetDays: number) => {\n      const d = new Date(time.now());\n      d.setDate(d.getDate() + offsetDays);\n      d.setHours(23, 59, 59, 999);\n      return d.getTime();\n    };`
    ),
  },

  // 5. calViewMonth/Year state init
  {
    from: esc(
      `  let calViewMonth = $state(new Date().getMonth());\n  let calViewYear  = $state(new Date().getFullYear());`
    ),
    to: esc(
      `  let calViewMonth = $state(time.getDate(time.now()).month - 1);\n  let calViewYear  = $state(time.getDate(time.now()).year);`
    ),
  },

  // 6. calViewData — const todayObj = new Date();
  {
    from: esc(
      `    const todayObj = new Date();\n    const firstOfMonth = new Date(calViewYear, calViewMonth, 1);`
    ),
    to: esc(
      `    const todayObj = new Date(time.now());\n    const firstOfMonth = new Date(calViewYear, calViewMonth, 1);`
    ),
  },

  // 7. calGoToday — const n = new Date();
  {
    from: esc(
      `    const n = new Date();\n    calViewMonth = n.getMonth();\n    calViewYear  = n.getFullYear();`
    ),
    to: esc(
      `    const n = new Date(time.now());\n    calViewMonth = n.getMonth();\n    calViewYear  = n.getFullYear();`
    ),
  },

  // 8. isToday — const d = new Date();
  {
    from: esc(
      `  function isToday(day: number, month: number, year: number): boolean {\n    const d = new Date();\n    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;\n  }`
    ),
    to: esc(
      `  function isToday(day: number, month: number, year: number): boolean {\n    const d = new Date(time.now());\n    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;\n  }`
    ),
  },

  // 9. applyReschedule — const now = new Date();
  {
    from: esc(`    const now = new Date();\n    showReschedule = false;`),
    to: esc(
      `    const nowMs = time.now();\n    const now = new Date(nowMs);\n    showReschedule = false;`
    ),
  },

  // 10. parseTaskInput — const now = new Date(); now.setHours(0,0,0,0);
  {
    from: esc(`    const now = new Date();\n    now.setHours(0, 0, 0, 0);`),
    to: esc(`    const now = new Date(time.dayStart(time.now()));`),
  },
];

let count = 0;
for (const r of replacements) {
  if (content.includes(r.from)) {
    content = content.replace(r.from, r.to);
    count++;
    console.log(`✅ Applied: ${r.from.substring(0, 50).replace(/\r?\n/g, '\\n')}...`);
  } else {
    console.log(`❌ Not found: ${r.from.substring(0, 50).replace(/\r?\n/g, '\\n')}...`);
  }
}

if (content !== original) {
  writeFileSync(filePath, content, 'utf-8');
  console.log(`\n✅ Done! Applied ${count} replacements`);
} else {
  console.log(`\n⚠️ No changes made`);
}

// Count remaining new Date()
const matches = content.match(/new Date\(\)/g);
console.log(`Remaining new Date(): ${matches ? matches.length : 0}`);

// Also count remaining toLocaleDateString/toLocaleTimeString/toISOString().slice
const dformat = content.match(/\.toLocale(D|T)/g);
console.log(`Remaining .toLocaleDateString/Time: ${dformat ? dformat.length : 0}`);
const isoSlice = content.match(/\.toISOString\(\)\.slice\(/g);
console.log(`Remaining .toISOString().slice(: ${isoSlice ? isoSlice.length : 0}`);

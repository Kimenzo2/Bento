/**
 * patch6.mjs — Fix remaining `new Date()` for current time in tasks/App.svelte
 * Uses exact line-by-line grep strings to ensure matches.
 */
import { readFileSync, writeFileSync } from 'fs';

const filePath =
  'C:/Users/admin/Downloads/Genesis/apps/genesis-desktop/src/modules/tasks/App.svelte';
let content = readFileSync(filePath, 'utf-8');
const original = content;

// Each replacement is [oldString, newString] — using exact strings from grep
const replacements = [
  // Line 171: const d = new Date();
  [
    `    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });`,
    `    return new Date(time.dayStart(time.now()));
  });`,
  ],

  // Lines 177-178: calendarMonth/Year
  [
    `  let calendarMonth = $state(new Date().getMonth());
  let calendarYear  = $state(new Date().getFullYear());`,
    `  let calendarMonth = $state(time.getDate(time.now()).month - 1);
  let calendarYear  = $state(time.getDate(time.now()).year);`,
  ],

  // Lines 445: const now = new Date(); (scheduleMidnightFlip)
  [
    `      const now = new Date();
      const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();`,
    `      const nowMs = time.now();
      const now = new Date(nowMs);
      const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - nowMs;`,
  ],

  // Line 451: const tomorrow = new Date();
  [
    `        const tomorrow = new Date();
        calendarMonth = tomorrow.getMonth();
        calendarYear  = tomorrow.getFullYear();`,
    `        const tomorrow = new Date(time.now());
        calendarMonth = tomorrow.getMonth();
        calendarYear  = tomorrow.getFullYear();`,
  ],

  // Line 544: const d = new Date(); (addContextDefaults)
  [
    `    const endOfDay = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    };`,
    `    const endOfDay = (offsetDays: number) => {
      const d = new Date(time.now());
      d.setDate(d.getDate() + offsetDays);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    };`,
  ],

  // Lines 896-897: calViewMonth/Year
  [
    `  let calViewMonth = $state(new Date().getMonth());
  let calViewYear  = $state(new Date().getFullYear());`,
    `  let calViewMonth = $state(time.getDate(time.now()).month - 1);
  let calViewYear  = $state(time.getDate(time.now()).year);`,
  ],

  // Line 963: const todayObj = new Date();
  [
    `    const todayObj = new Date();
    const firstOfMonth = new Date(calViewYear, calViewMonth, 1);`,
    `    const todayObj = new Date(time.now());
    const firstOfMonth = new Date(calViewYear, calViewMonth, 1);`,
  ],

  // Line 1034: const n = new Date();
  [
    `    const n = new Date();
    calViewMonth = n.getMonth();
    calViewYear  = n.getFullYear();`,
    `    const n = new Date(time.now());
    calViewMonth = n.getMonth();
    calViewYear  = n.getFullYear();`,
  ],

  // Line 1104: const d = new Date(); (isToday)
  [
    `  function isToday(day: number, month: number, year: number): boolean {
    const d = new Date();
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  }`,
    `  function isToday(day: number, month: number, year: number): boolean {
    const d = new Date(time.now());
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  }`,
  ],

  // Line 1159: const now = new Date(); (applyReschedule)
  [
    `    const now = new Date();
    showReschedule = false;`,
    `    const nowMs = time.now();
    const now = new Date(nowMs);
    showReschedule = false;`,
  ],

  // Line 1430: const now = new Date(); (parseTaskInput)
  [
    `    const now = new Date();
    now.setHours(0, 0, 0, 0);`,
    `    const now = new Date(time.dayStart(time.now()));`,
  ],

  // Line 2144: year select options
  [
    `{#each Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 5 + i) as yr}`,
    `{#each Array.from({ length: 20 }, (_, i) => time.getDate(time.now()).year - 5 + i) as yr}`,
  ],

  // Line 2487: detail Today button
  [
    `                const d = new Date(); d.setHours(23, 59, 59, 999);`,
    `                const d = time.dayStart(time.now()) + time.DAY - 1000;`,
  ],

  // Line 2495: detail Tomorrow button
  [
    `                const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 59, 999);`,
    `                const d = time.dayStart(time.now()) + 2 * time.DAY - 1000;`,
  ],

  // Line 2502: detail Next Week button
  [
    `                const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 59, 999);`,
    `                const d = time.dayStart(time.now()) + 8 * time.DAY - 1000;`,
  ],

  // Line 2509: detail Next Month button
  [
    `                const d = new Date(); d.setMonth(d.getMonth() + 1); d.setHours(23, 59, 59, 999);`,
    `                const d = new Date(time.now()); d.setMonth(d.getMonth() + 1); d.setHours(23, 59, 59, 999);`,
  ],
];

let count = 0;
for (const [oldStr, newStr] of replacements) {
  const idx = content.indexOf(oldStr);
  if (idx !== -1) {
    content = content.replace(oldStr, newStr);
    count++;
    console.log(`✅ Applied: ${oldStr.substring(0, 70).replace(/\n/g, '\\n')}...`);
  } else {
    console.log(`⚠️  Not found: ${oldStr.substring(0, 70).replace(/\n/g, '\\n')}...`);
  }
}

if (content !== original) {
  writeFileSync(filePath, content, 'utf-8');
  console.log(`\n✅ Done! Applied ${count} replacements to tasks/App.svelte`);
} else {
  console.log(`\n⚠️  No changes made`);
}

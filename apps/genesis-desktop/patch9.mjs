import { readFileSync, writeFileSync } from 'fs';

const path =
  'C:\\Users\\admin\\Downloads\\Genesis\\apps\\genesis-desktop\\src\\modules\\tasks\\App.svelte';
let src = readFileSync(path, 'utf8');
const orig = src;

// Helper to replace with literal strings
function replace(oldStr, newStr) {
  // Normalize both to \r\n
  const normalOld = oldStr.replace(/\r?\n/g, '\r\n');
  const normalNew = newStr.replace(/\r?\n/g, '\r\n');
  if (src.includes(normalOld)) {
    src = src.replace(normalOld, normalNew);
    console.log(`✅ Applied: ${oldStr.slice(0, 60)}...`);
    return true;
  }
  console.log(`❌ Not found: ${oldStr.slice(0, 60)}...`);
  return false;
}

// Replacement 1: formatDate function (line ~775)
replace(
  `  function formatDate(ts: number | null): string {\r\n    if (ts === null) return '';\r\n    const d = new Date(ts);\r\n    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });\r\n  }`,
  `  function formatDate(ts: number | null): string {\r\n    if (ts === null) return '';\r\n    return time.formatCustom(ts, 'M j');\r\n  }`
);

// Replacement 2: formatDueDate function (lines ~1262-1270)
replace(
  `  function formatDueDate(ts: number | null): string | null {\r\n    if (ts === null) return null;\r\n    const d = new Date(ts);\r\n    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());\r\n    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());\r\n    const diff = Math.round((dateOnly.getTime() - todayOnly.getTime()) / 86_400_000);\r\n    if (diff === 0) return 'Today';\r\n    if (diff === 1) return 'Tomorrow';\r\n    if (diff === -1) return 'Yesterday';\r\n    if (diff > 0 && diff <= 7) return d.toLocaleDateString('en-US', { weekday: 'short' });\r\n    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });\r\n  }`,
  `  function formatDueDate(ts: number | null): string | null {\r\n    if (ts === null) return null;\r\n    const d = new Date(ts);\r\n    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());\r\n    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());\r\n    const diff = Math.round((dateOnly.getTime() - todayOnly.getTime()) / 86_400_000);\r\n    if (diff === 0) return 'Today';\r\n    if (diff === 1) return 'Tomorrow';\r\n    if (diff === -1) return 'Yesterday';\r\n    if (diff > 0 && diff <= 7) return time.formatCustom(ts, 'D');\r\n    return time.formatCustom(ts, 'M j');\r\n  }`
);

// Replacement 3: calendar overflow popover first use
replace(
  `            {new Date(calOverflow.year, calOverflow.month, calOverflow.day)\r\n              .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
  `            {time.formatCustom(\r\n              time.fromComponents(calOverflow.year, calOverflow.month + 1, calOverflow.day),\r\n              'D, M j')}`
);

// Replacement 4: calendar quick-add bar date (second instance is similar structure but slightly different context)
// Find and replace the second instance
replace(
  `            {new Date(calQuickAddTarget.year, calQuickAddTarget.month, calQuickAddTarget.day)\r\n              .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
  `            {time.formatCustom(\r\n              time.fromComponents(calQuickAddTarget.year, calQuickAddTarget.month + 1, calQuickAddTarget.day),\r\n              'D, M j')}`
);

// Replacement 5: Activity log due date display (line ~2996)
replace(
  `{entry.dueDate ? new Date(parseInt(entry.dueDate)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`,
  `{entry.dueDate ? time.formatCustom(parseInt(entry.dueDate), 'M j') : ''}`
);

if (src !== orig) {
  writeFileSync(path, src, 'utf8');
  console.log('\n✅ File written successfully.');
} else {
  console.log('\n⚠️  No changes made — file was not modified.');
}

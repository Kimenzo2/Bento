import { readFileSync, writeFileSync } from 'fs';

const f = 'src/modules/tasks/App.svelte';
let c = readFileSync(f, 'utf-8');
let lines = c.split('\n');

// --- Step 1: Insert showShare state variables after 'let showShortcuts = $state(false);' ---
let showShortcutsIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('let showShortcuts = $state(false);')) {
    showShortcutsIdx = i;
    break;
  }
}

if (showShortcutsIdx === -1) {
  console.error('Could not find showShortcuts state variable.');
  process.exit(1);
}

// Check if showShare is already there
let alreadyHasShare = lines.some(l => l.includes('let showShare'));
if (!alreadyHasShare) {
  lines.splice(showShortcutsIdx + 1, 0, '', '  // Share', '  let showShare = $state(false);', '  let shareContent = $state(\'\');');
  console.log('Added showShare and shareContent state variables.');
}

// --- Step 2: Add openShare function ---
// Find the position after the share state vars and before Shortcuts/comments
let openShareExists = lines.some(l => l.includes('async function openShare'));
if (!openShareExists) {
  // Find where to insert - after the share state variables, before '// Overdue reschedule dialog'
  let insertIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('let shareContent =')) {
      insertIdx = i + 1;
      break;
    }
  }
  
  if (insertIdx > 0) {
    lines.splice(insertIdx, 0, '',
      '  async function openShare() {',
      '    const allTasks = await listTasks({ limit: 10000 });',
      '    shareContent = formatTasksAsMarkdown(allTasks, `Bento Tasks — ${viewTitle}`);',
      '    showShare = true;',
      '  }');
    console.log('Added openShare function.');
  }
}

// --- Step 3: Add Share button in sidebar ---
let hasShareButton = lines.some(l => l.includes('Share2 size={14}'));
if (!hasShareButton) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('title="Import tasks"') && lines[i+1] && lines[i+1].includes('FileText')) {
      // Found the Import button, add Share after it
      lines.splice(i + 3, 0,
        '      <button class="tasks-sidebar-settings-btn" onclick={openShare} title="Share tasks">',
        '        <Share2 size={14} />',
        '        <span>Share</span>',
        '      </button>');
      break;
    }
  }
}

writeFileSync(f, lines.join('\n'), 'utf-8');
console.log('Tasks module v3 patched successfully.');

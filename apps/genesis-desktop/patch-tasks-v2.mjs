import { readFileSync, writeFileSync } from 'fs';

const f = 'src/modules/tasks/App.svelte';
let c = readFileSync(f, 'utf-8');

// Check if showShare already exists
if (!c.includes('let showShare')) {
  // Add state variables AFTER 'let showShortcuts = $state(false);'
  c = c.replace(
    'let showShortcuts = $state(false);\n\n  async function openShare',
    "let showShortcuts = $state(false);\n\n  // Share\n  let showShare = $state(false);\n  let shareContent = $state('');\n\n  async function openShare"
  );
}

// Check if openShare function exists
if (!c.includes('async function openShare')) {
  // Find a good insertion point for openShare - before "// Shortcuts reference overlay"
  // Actually, let's add it right after showShortcuts but before showReschedule
  c = c.replace(
    "// Share\n  let showShare = $state(false);\n  let shareContent = $state('');\n\n  // Shortcuts reference overlay",
    "// Share\n  let showShare = $state(false);\n  let shareContent = $state('');\n\n  async function openShare() {\n    const allTasks = await listTasks({ limit: 10000 });\n    shareContent = formatTasksAsMarkdown(allTasks, `Bento Tasks — ${viewTitle}`);\n    showShare = true;\n  }\n\n  // Shortcuts reference overlay"
  );
}

// Check if Share button exists in sidebar
if (!c.includes('Share2 size={14}')) {
  // Add Share button after Import button
  c = c.replace(
    '<button class="tasks-sidebar-settings-btn" onclick={() => { showImport = true; importPreview = null; importResult = null; }} title="Import tasks">\n        <FileText size={14} />\n        <span>Import</span>\n      </button>',
    '<button class="tasks-sidebar-settings-btn" onclick={() => { showImport = true; importPreview = null; importResult = null; }} title="Import tasks">\n        <FileText size={14} />\n        <span>Import</span>\n      </button>\n      <button class="tasks-sidebar-settings-btn" onclick={openShare} title="Share tasks">\n        <Share2 size={14} />\n        <span>Share</span>\n      </button>'
  );
}

writeFileSync(f, c, 'utf-8');
console.log('Tasks module v2 patched successfully.');

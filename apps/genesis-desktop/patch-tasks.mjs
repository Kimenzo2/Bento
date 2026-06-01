import { readFileSync, writeFileSync } from 'fs';

const f = 'src/modules/tasks/App.svelte';
let c = readFileSync(f, 'utf-8');

// 1. Add Share2 to lucide import
c = c.replace('Play, Square, Download, FileText', 'Play, Square, Download, FileText, Share2');

// 2. Add ShareSheet and share-service imports after time import
c = c.replace(
  "import { time } from '$lib/utils/time';",
  "import { time } from '$lib/utils/time';\nimport ShareSheet from '$lib/components/ShareSheet.svelte';\nimport { formatTasksAsMarkdown } from '$lib/services/share-service';"
);

// 3. Add share state variables after showShortcuts
c = c.replace(
  '// Shortcuts reference overlay\n  let showShortcuts = $state(false);',
  "// Shortcuts reference overlay\n  let showShortcuts = $state(false);\n\n  // Share\n  let showShare = $state(false);\n  let shareContent = $state('');"
);

// 4. Add openShare function before EXPORT section
c = c.replace(
  '/* ═══════════════════════════════════════════════════════════════════\n     EXPORT',
  '  async function openShare() {\n    const allTasks = await listTasks({ limit: 10000 });\n    shareContent = formatTasksAsMarkdown(allTasks, `Bento Tasks — ${viewTitle}`);\n    showShare = true;\n  }\n\n  /* ═══════════════════════════════════════════════════════════════════\n     EXPORT'
);

// 5. Add share button in sidebar footer (after Import button)
c = c.replace(
  '<button class="tasks-sidebar-settings-btn" onclick={() => { showImport = true; importPreview = null; importResult = null; }} title="Import tasks">\n        <FileText size={14} />\n        <span>Import</span>\n      </button>',
  '<button class="tasks-sidebar-settings-btn" onclick={() => { showImport = true; importPreview = null; importResult = null; }} title="Import tasks">\n        <FileText size={14} />\n        <span>Import</span>\n      </button>\n      <button class="tasks-sidebar-settings-btn" onclick={openShare} title="Share tasks">\n        <Share2 size={14} />\n        <span>Share</span>\n      </button>'
);

// 6. Add ShareSheet component before the undo toasts container
c = c.replace(
  '<!-- ─── UNDO TOASTS ─── -->',
  '<ShareSheet bind:open={showShare} content={shareContent} title="Share Tasks" label={viewTitle} filename={`bento-tasks-${new Date().toISOString().slice(0,10)}`} />\n\n<!-- ─── UNDO TOASTS ─── -->'
);

writeFileSync(f, c, 'utf-8');
console.log('Tasks module patched successfully.');

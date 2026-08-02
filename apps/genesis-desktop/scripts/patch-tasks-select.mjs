// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = resolve(__dirname, '..', 'src', 'modules', 'tasks', 'App.svelte');

let content = readFileSync(filePath, 'utf-8');

// 1. Add import for CustomSelect
content = content.replace(
  "import { formatTasksAsMarkdown } from '$lib/services/share-service';",
  "import { formatTasksAsMarkdown } from '$lib/services/share-service';\nimport CustomSelect from '$lib/components/ui/CustomSelect.svelte';"
);

// 2. Add monthOptions and yearOptions after calViewYear declaration
content = content.replace(
  '  let calViewYear  = $state(time.getDate(time.now()).year);',
  "  let calViewYear  = $state(time.getDate(time.now()).year);\n\n  let monthOptions = [\n    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },\n    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },\n    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },\n    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' },\n  ];\n  let yearOptions = Array.from({ length: 20 }, (_, i) => ({\n    value: time.getDate(time.now()).year - 5 + i,\n    label: String(time.getDate(time.now()).year - 5 + i),\n  }));"
);

// 3. Replace month select
const monthSelectPattern = `          <select\n            class="tasks-cal-select"\n            bind:value={calViewMonth}\n            aria-label="Month"\n          >\n            {#each ['January','February','March','April','May','June','July','August','September','October','November','December'] as name, i}\n              <option value={i}>{name}</option>\n            {/each}\n          </select>`;

const monthSelectReplacement = `          <CustomSelect\n            options={monthOptions}\n            bind:value={calViewMonth}\n            id="tasks-cal-month"\n            aria-label="Month"\n            class="tasks-cal-select"\n          />`;

content = content.replace(monthSelectPattern, monthSelectReplacement);

// 4. Replace year select
const yearSelectPattern = `          <select\n            class="tasks-cal-select"\n            bind:value={calViewYear}\n            aria-label="Year"\n          >\n            {#each Array.from({ length: 20 }, (_, i) => time.getDate(time.now()).year - 5 + i) as yr}\n              <option value={yr}>{yr}</option>\n            {/each}\n          </select>`;

const yearSelectReplacement = `          <CustomSelect\n            options={yearOptions}\n            bind:value={calViewYear}\n            id="tasks-cal-year"\n            aria-label="Year"\n            class="tasks-cal-select"\n          />`;

content = content.replace(yearSelectPattern, yearSelectReplacement);

writeFileSync(filePath, content, 'utf-8');
console.log('✅ Patched successfully');
console.log(
  'Replacements:',
  content.includes('CustomSelect') ? 'Import added ✅' : 'Import MISSING ❌'
);
console.log('Month options:', content.includes('monthOptions') ? 'Added ✅' : 'MISSING ❌');
console.log('Year options:', content.includes('yearOptions') ? 'Added ✅' : 'MISSING ❌');
console.log(
  'Month select replaced:',
  !content.includes(
    '<select\\n            class="tasks-cal-select"\\n            bind:value={calViewMonth}'
  )
    ? '✅'
    : '❌'
);

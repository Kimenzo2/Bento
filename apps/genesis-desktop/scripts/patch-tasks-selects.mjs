import { readFileSync, writeFileSync } from 'fs';

const path = 'src/modules/tasks/App.svelte';
let content = readFileSync(path, 'utf-8');
const original = content;

// 1. Remove the CustomSelect import line
content = content.replace(
  "import CustomSelect from '$lib/components/ui/CustomSelect.svelte';\r\n",
  ''
);
content = content.replace(
  "import CustomSelect from '$lib/components/ui/CustomSelect.svelte';\n",
  ''
);

// 2. Replace month select
content = content.replace(
  `\t\t  <CustomSelect\n            options={monthOptions}\n            bind:value={calViewMonth}\n            id="tasks-cal-month"\n            aria-label="Month"\n            class="tasks-cal-select"\n          />`,
  `\t\t  <Select.Root type="single" bind:value={calViewMonth}>\n            <Select.Trigger class="tasks-cal-select" id="tasks-cal-month" aria-label="Month">\n              {monthOptions.find(f => f.value === calViewMonth)?.label ?? 'Month'}\n            </Select.Trigger>\n            <Select.Content>\n              {#each monthOptions as opt (opt.value)}\n                <Select.Item value={opt.value}>{opt.label}</Select.Item>\n              {/each}\n            </Select.Content>\n          </Select.Root>`
);

// 3. Replace year select
content = content.replace(
  `\t\t  <CustomSelect\n            options={yearOptions}\n            bind:value={calViewYear}\n            id="tasks-cal-year"\n            aria-label="Year"\n            class="tasks-cal-select"\n          />`,
  `\t\t  <Select.Root type="single" bind:value={calViewYear}>\n            <Select.Trigger class="tasks-cal-select" id="tasks-cal-year" aria-label="Year">\n              {yearOptions.find(f => f.value === calViewYear)?.label ?? 'Year'}\n            </Select.Trigger>\n            <Select.Content>\n              {#each yearOptions as opt (opt.value)}\n                <Select.Item value={opt.value}>{opt.label}</Select.Item>\n              {/each}\n            </Select.Content>\n          </Select.Root>`
);

if (content === original) {
  console.error('✗ No changes were made! Checking for exact CustomSelect occurrences...');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('CustomSelect')) {
      console.log(`  Line ${i + 1}: ${JSON.stringify(line)}`);
    }
  });
  process.exit(1);
}

writeFileSync(path, content);
console.log('✓ Tasks App.svelte patched');

// Verify
const check = readFileSync(path, 'utf-8');
const remaining = check.split('\n').filter((l) => l.includes('CustomSelect'));
if (remaining.length > 0) {
  console.error(`✗ ${remaining.length} CustomSelect references remain:`);
  remaining.forEach((l) => console.log(`  ${JSON.stringify(l.trim())}`));
  process.exit(1);
}
console.log('  Verified: 0 CustomSelect references remain in Tasks');

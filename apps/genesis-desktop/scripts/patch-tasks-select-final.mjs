import { readFileSync, writeFileSync } from 'fs';

const path = 'src/modules/tasks/App.svelte';
let content = readFileSync(path, 'utf-8');
const original = content;

// Month CustomSelect → Select.Root (Windows CRLF line endings)
content = content.replace(
  '          <CustomSelect\r\n            options={monthOptions}\r\n            bind:value={calViewMonth}\r\n            id="tasks-cal-month"\r\n            aria-label="Month"\r\n            class="tasks-cal-select"\r\n          />',
  '          <Select.Root type="single" bind:value={calViewMonth}>\r\n            <Select.Trigger class="tasks-cal-select" id="tasks-cal-month" aria-label="Month">\r\n              {monthOptions.find(f => f.value === calViewMonth)?.label ?? \'Month\'}\r\n            </Select.Trigger>\r\n            <Select.Content>\r\n              {#each monthOptions as opt (opt.value)}\r\n                <Select.Item value={opt.value}>{opt.label}</Select.Item>\r\n              {/each}\r\n            </Select.Content>\r\n          </Select.Root>'
);

// Year CustomSelect → Select.Root
content = content.replace(
  '          <CustomSelect\r\n            options={yearOptions}\r\n            bind:value={calViewYear}\r\n            id="tasks-cal-year"\r\n            aria-label="Year"\r\n            class="tasks-cal-select"\r\n          />',
  '          <Select.Root type="single" bind:value={calViewYear}>\r\n            <Select.Trigger class="tasks-cal-select" id="tasks-cal-year" aria-label="Year">\r\n              {yearOptions.find(f => f.value === calViewYear)?.label ?? \'Year\'}\r\n            </Select.Trigger>\r\n            <Select.Content>\r\n              {#each yearOptions as opt (opt.value)}\r\n                <Select.Item value={opt.value}>{opt.label}</Select.Item>\r\n              {/each}\r\n            </Select.Content>\r\n          </Select.Root>'
);

if (content === original) {
  console.error('✗ No changes made!');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('CustomSelect')) {
      console.log(`  Line ${i + 1}: ${JSON.stringify(line)}`);
    }
  });
  process.exit(1);
}

writeFileSync(path, content);
console.log('✓ Tasks patched successfully');

// Verify
const check = readFileSync(path, 'utf-8');
const remaining = check.split('\n').filter((l) => l.includes('CustomSelect'));
if (remaining.length > 0) {
  console.error(`✗ ${remaining.length} CustomSelect references remain`);
  remaining.forEach((l) => console.log(`  ${JSON.stringify(l.trim())}`));
  process.exit(1);
}
console.log('  Verified: 0 CustomSelect references remain in Tasks');

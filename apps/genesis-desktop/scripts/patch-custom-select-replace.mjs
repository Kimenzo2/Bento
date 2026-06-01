import { readFileSync, writeFileSync, unlinkSync } from 'fs';

/* ═════════════════════════════════════════════════════════════════════
   FILE 1: src/modules/budget/App.svelte
   ═════════════════════════════════════════════════════════════════════ */
let budget = readFileSync('src/modules/budget/App.svelte', 'utf-8');

// 1a. Replace import
budget = budget.replace(
  "  import CustomSelect from '$lib/components/ui/CustomSelect.svelte';",
  `  import * as Select from "$lib/components/ui/select/index.js";`
);

// 1b. Replace category select in tx modal
budget = budget.replace(
  `                <CustomSelect options={categoryOptions} bind:value={newTx.categoryId} id="tx-category" placeholder="Select category\u2026" />`,
  `                <Select.Root type="single" bind:value={newTx.categoryId}>
                  <Select.Trigger class="w-full" id="tx-category">
                    {categoryOptions.find(f => f.value === newTx.categoryId)?.label ?? 'Select category\u2026'}
                  </Select.Trigger>
                  <Select.Content>
                    {#each categoryOptions as opt (opt.value)}
                      <Select.Item value={opt.value}>{opt.label}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>`
);

// 1c. Replace bill category select
budget = budget.replace(
  `                <CustomSelect options={categoryOptions} bind:value={newBill.categoryId} id="bill-category" placeholder="Uncategorized" />`,
  `                <Select.Root type="single" bind:value={newBill.categoryId}>
                  <Select.Trigger class="w-full" id="bill-category">
                    {categoryOptions.find(f => f.value === newBill.categoryId)?.label ?? 'Uncategorized'}
                  </Select.Trigger>
                  <Select.Content>
                    {#each categoryOptions as opt (opt.value)}
                      <Select.Item value={opt.value}>{opt.label}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>`
);

// 1d. Replace AI provider select
budget = budget.replace(
  `                <CustomSelect options={aiProviderOptions} bind:value={newAi.provider} id="ai-provider" placeholder="Select provider\u2026" />`,
  `                <Select.Root type="single" bind:value={newAi.provider}>
                  <Select.Trigger class="w-full" id="ai-provider">
                    {aiProviderOptions.find(f => f.value === newAi.provider)?.label ?? 'Select provider\u2026'}
                  </Select.Trigger>
                  <Select.Content>
                    {#each aiProviderOptions as opt (opt.value)}
                      <Select.Item value={opt.value}>{opt.label}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>`
);

writeFileSync('src/modules/budget/App.svelte', budget);
console.log('✓ Budget App.svelte patched');

// Quick sanity
const budgetCheck = readFileSync('src/modules/budget/App.svelte', 'utf-8');
if (budgetCheck.includes('CustomSelect')) {
  console.error('✗ ERROR: Budget still has CustomSelect references!');
  process.exit(1);
} else {
  console.log('  Verified: no remaining CustomSelect references in Budget');
}

/* ═════════════════════════════════════════════════════════════════════
   FILE 2: src/modules/tasks/App.svelte
   ═════════════════════════════════════════════════════════════════════ */
let tasks = readFileSync('src/modules/tasks/App.svelte', 'utf-8');

// 2a. Remove the CustomSelect import line (already has Select import on line 11)
tasks = tasks.replace("import CustomSelect from '$lib/components/ui/CustomSelect.svelte';\n", '');

// 2b. Replace month select
tasks = tasks.replace(
  `          <CustomSelect
            options={monthOptions}
            bind:value={calViewMonth}
            id="tasks-cal-month"
            aria-label="Month"
            class="tasks-cal-select"
          />`,
  `          <Select.Root type="single" bind:value={calViewMonth}>
            <Select.Trigger class="tasks-cal-select" id="tasks-cal-month" aria-label="Month">
              {monthOptions.find(f => f.value === calViewMonth)?.label ?? 'Month'}
            </Select.Trigger>
            <Select.Content>
              {#each monthOptions as opt (opt.value)}
                <Select.Item value={opt.value}>{opt.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>`
);

// 2c. Replace year select
tasks = tasks.replace(
  `          <CustomSelect
            options={yearOptions}
            bind:value={calViewYear}
            id="tasks-cal-year"
            aria-label="Year"
            class="tasks-cal-select"
          />`,
  `          <Select.Root type="single" bind:value={calViewYear}>
            <Select.Trigger class="tasks-cal-select" id="tasks-cal-year" aria-label="Year">
              {yearOptions.find(f => f.value === calViewYear)?.label ?? 'Year'}
            </Select.Trigger>
            <Select.Content>
              {#each yearOptions as opt (opt.value)}
                <Select.Item value={opt.value}>{opt.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>`
);

writeFileSync('src/modules/tasks/App.svelte', tasks);
console.log('✓ Tasks App.svelte patched');

// Sanity
const tasksCheck = readFileSync('src/modules/tasks/App.svelte', 'utf-8');
if (tasksCheck.includes('CustomSelect')) {
  console.error('✗ ERROR: Tasks still has CustomSelect references!');
  process.exit(1);
} else {
  console.log('  Verified: no remaining CustomSelect references in Tasks');
}

/* ═════════════════════════════════════════════════════════════════════
   CLEANUP: Delete CustomSelect.svelte
   ═════════════════════════════════════════════════════════════════════ */
try {
  unlinkSync('src/lib/components/ui/CustomSelect.svelte');
  console.log('✓ Deleted src/lib/components/ui/CustomSelect.svelte');
} catch (e) {
  console.log('  Note: CustomSelect.svelte already deleted or not found');
}

console.log('\n✅ All replacements complete');

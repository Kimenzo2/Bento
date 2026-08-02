// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = resolve(__dirname, '..', 'src', 'modules', 'tasks', 'App.svelte');

let content = readFileSync(filePath, 'utf-8');

// 1. Replace month select
const monthOld = `<select\r\n            class="tasks-cal-select"\r\n            bind:value={calViewMonth}\r\n            aria-label="Month"\r\n          >\r\n            {#each ['January','February','March','April','May','June','July','August','September','October','November','December'] as name, i}\r\n              <option value={i}>{name}</option>\r\n            {/each}\r\n          </select>`;

const monthNew = `<CustomSelect\r\n            options={monthOptions}\r\n            bind:value={calViewMonth}\r\n            id="tasks-cal-month"\r\n            aria-label="Month"\r\n            class="tasks-cal-select"\r\n          />`;

if (content.includes(monthOld)) {
  content = content.replace(monthOld, monthNew);
  console.log('✅ Month select replaced');
} else {
  console.log('❌ Month select pattern NOT FOUND');
  // Try with \n instead of \r\n
  const altOld = monthOld.replace(/\r\n/g, '\n');
  if (content.includes(altOld)) {
    content = content.replace(altOld, monthNew.replace(/\r\n/g, '\n'));
    console.log('✅ Month select replaced (alt)');
  } else {
    console.log('❌ Month select NOT FOUND even with alt');
  }
}

// 2. Replace year select
const yearOld = `<select\r\n            class="tasks-cal-select"\r\n            bind:value={calViewYear}\r\n            aria-label="Year"\r\n          >\r\n            {#each Array.from({ length: 20 }, (_, i) => time.getDate(time.now()).year - 5 + i) as yr}\r\n              <option value={yr}>{yr}</option>\r\n            {/each}\r\n          </select>`;

const yearNew = `<CustomSelect\r\n            options={yearOptions}\r\n            bind:value={calViewYear}\r\n            id="tasks-cal-year"\r\n            aria-label="Year"\r\n            class="tasks-cal-select"\r\n          />`;

if (content.includes(yearOld)) {
  content = content.replace(yearOld, yearNew);
  console.log('✅ Year select replaced');
} else {
  console.log('❌ Year select pattern NOT FOUND');
  // Try with \n instead of \r\n
  const altOld = yearOld.replace(/\r\n/g, '\n');
  if (content.includes(altOld)) {
    content = content.replace(altOld, yearNew.replace(/\r\n/g, '\n'));
    console.log('✅ Year select replaced (alt)');
  } else {
    console.log('❌ Year select NOT FOUND even with alt');
  }
}

// 3. Check for any remaining native selects
const remainingSelects = (content.match(/<select/g) || []).length;
console.log(`\nRemaining native <select> tags: ${remainingSelects}`);

writeFileSync(filePath, content, 'utf-8');
console.log('✅ File saved');

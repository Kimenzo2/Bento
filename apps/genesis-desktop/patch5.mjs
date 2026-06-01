/**
 * patch5.mjs — Replace remaining hardcoded `new Date()` (current time) in tasks/App.svelte
 * Only fixes instances that get the CURRENT TIME, not calendar grid Date constructions.
 */
import { readFileSync, writeFileSync } from 'fs';

const filePath =
  'C:/Users/admin/Downloads/Genesis/apps/genesis-desktop/src/modules/tasks/App.svelte';
let content = readFileSync(filePath, 'utf-8');
const original = content;

// Helper replacements map: [oldString, newString]
const replacements = [
  // 1. calendarMonth/Year state init
  [
    `let calendarMonth = $state(new Date().getMonth());
  let calendarYear  = $state(new Date().getFullYear());`,
    `let calendarMonth = $state(time.getDate(time.now()).month - 1);
  let calendarYear  = $state(time.getDate(time.now()).year);`,
  ],

  // 2. calViewMonth/Year state init
  [
    `let calViewMonth = $state(new Date().getMonth());
  let calViewYear  = $state(new Date().getFullYear());`,
    `let calViewMonth = $state(time.getDate(time.now()).month - 1);
  let calViewYear  = $state(time.getDate(time.now()).year);`,
  ],

  // 3. scheduleMidnightFlip — const now = new Date()
  [
    `const now = new Date();
      const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();`,
    `const nowMs = time.now();
      const now = new Date(nowMs);
      const msUntilMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - nowMs;`,
  ],

  // 4. scheduleMidnightFlip — const tomorrow = new Date()
  [
    `const tomorrow = new Date();
        calendarMonth = tomorrow.getMonth();
        calendarYear  = tomorrow.getFullYear();`,
    `const tomorrow = new Date(time.now());
        calendarMonth = tomorrow.getMonth();
        calendarYear  = tomorrow.getFullYear();`,
  ],

  // 5. addContextDefaults — const d = new Date()
  [
    `const endOfDay = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    };`,
    `const endOfDay = (offsetDays: number) => {
      const d = new Date(time.now());
      d.setDate(d.getDate() + offsetDays);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    };`,
  ],

  // 6. calViewData — const todayObj = new Date()
  [
    `const todayObj = new Date();
    const firstOfMonth = new Date(calViewYear, calViewMonth, 1);`,
    `const todayObj = new Date(time.now());
    const firstOfMonth = new Date(calViewYear, calViewMonth, 1);`,
  ],

  // 7. calGoToday — const n = new Date()
  [
    `const n = new Date();
    calViewMonth = n.getMonth();
    calViewYear  = n.getFullYear();`,
    `const n = new Date(time.now());
    calViewMonth = n.getMonth();
    calViewYear  = n.getFullYear();`,
  ],

  // 8. isToday — const d = new Date()
  [
    `function isToday(day: number, month: number, year: number): boolean {
    const d = new Date();
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  }`,
    `function isToday(day: number, month: number, year: number): boolean {
    const d = new Date(time.now());
    return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
  }`,
  ],

  // 9. applyReschedule — const now = new Date();
  [
    `const now = new Date();
    showReschedule = false;

    for (const [taskId, action] of rescheduleActions) {`,
    `const nowMs2 = time.now();
    const now = new Date(nowMs2);
    showReschedule = false;

    for (const [taskId, action] of rescheduleActions) {`,
  ],

  // 10. parseTaskInput — const now = new Date(); now.setHours(0,0,0,0);
  [
    `const now = new Date();
    now.setHours(0, 0, 0, 0);`,
    `const now = new Date(time.dayStart(time.now()));
    `,
  ],

  // 11. NLP parser baseDate — let baseDate = new Date(now);
  [
    `let baseDate = new Date(now);
      if (dayRef === 'tomorrow') baseDate.setDate(baseDate.getDate() + 1);`,
    `let baseDate = new Date(time.now());
      if (dayRef === 'tomorrow') baseDate.setDate(baseDate.getDate() + 1);`,
  ],

  // 12. NLP parser d = new Date(now)
  [
    `const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 999);`,
    `const d = new Date(time.now());
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 999);`,
  ],

  // 13. NLP parser d = new Date(now) for today/tomorrow/nextweek/nextmonth
  [
    `const d = new Date(now);
      d.setHours(23, 59, 59, 999);
      dueDateStr = d.toISOString();
      title = title.replace(todayMatch[0], '');`,
    `const d = new Date(time.now());
      d.setHours(23, 59, 59, 999);
      dueDateStr = d.toISOString();
      title = title.replace(todayMatch[0], '');`,
  ],

  [
    `const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 59, 999);`,
    `const d = new Date(time.now());
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 59, 999);`,
  ],

  // 14. generateMarkdown — new Date().toLocaleString()
  [
    `const lines: string[] = ['# Bento Tasks Export', '', \`_Generated \${new Date().toLocaleString()}_\`, '', '---', ''];`,
    "const lines: string[] = ['# Bento Tasks Export', '', `_Generated ${time.format(time.now())}_`, '', '---', ''];",
  ],

  // 15. generateMarkdown — new Date(t.createdAt).toISOString()
  [
    `t.completedAt?.toString() ?? '', new Date(t.createdAt).toISOString(),`,
    `t.completedAt?.toString() ?? '', time.toISODateTime(t.createdAt),`,
  ],

  // 16. generateMarkdown — new Date(t.dueAt).toLocaleDateString(...)
  [
    `const dueStr = t.dueAt ? \` *(due \${new Date(t.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\${t.dueTime ? ' at ' + t.dueTime : ''})*\` : '';`,
    "const dueStr = t.dueAt ? ` *(due ${time.formatCustom(t.dueAt, 'M j')}${t.dueTime ? ' at ' + t.dueTime : ''})*` : '';",
  ],

  // 17. generateMarkdown — new Date(t.completedAt).toLocaleDateString()
  [
    `const dateStr = t.completedAt ? \` *(completed \${new Date(t.completedAt).toLocaleDateString()})*\` : '';`,
    "const dateStr = t.completedAt ? ` *(completed ${time.formatDate(t.completedAt)})*` : '';",
  ],

  // 18. Year select options — new Date().getFullYear()
  [
    `{Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 5 + i) as yr}`,
    `{Array.from({ length: 20 }, (_, i) => time.getDate(time.now()).year - 5 + i) as yr}`,
  ],

  // 19. Calendar overflow popover — new Date(year, month, day).toLocaleDateString(...)
  [
    `{new Date(calOverflow.year, calOverflow.month, calOverflow.day)
              .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    `{time.formatCustom(time.fromComponents(calOverflow.year, calOverflow.month + 1, calOverflow.day), 'D, M j')}`,
  ],

  // 20. Calendar quick-add target date — same pattern
  [
    `{new Date(calQuickAddTarget.year, calQuickAddTarget.month, calQuickAddTarget.day)
              .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    `{time.formatCustom(time.fromComponents(calQuickAddTarget.year, calQuickAddTarget.month + 1, calQuickAddTarget.day), 'D, M j')}`,
  ],

  // 21. Timeline date — formatDate(new Date(date).getTime())
  [`formatDate(new Date(date).getTime())`, `time.formatCustom(parseInt(date), 'M j')`],

  // 22. Mini calendar month/year — new Date(year, month).toLocaleDateString(...)
  [
    `{new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    `{time.formatCustom(time.fromComponents(calendarYear, calendarMonth + 1, 1), 'F Y')}`,
  ],

  // 23. Detail Today button — const d = new Date(); d.setHours(23,59,59,999);
  [
    `const d = new Date(); d.setHours(23, 59, 59, 999);
                setDueDate(d.getTime());`,
    `setDueDate(time.dayStart(time.now()) + time.DAY - 1000);`,
  ],

  // 24. Detail Tomorrow button — const d = new Date(); d.setDate(...)
  [
    `const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 59, 999);
                setDueDate(d.getTime());`,
    `setDueDate(time.dayStart(time.now()) + 2 * time.DAY - 1000);`,
  ],

  // 25. Detail Next Week button
  [
    `const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 59, 999);
                setDueDate(d.getTime());`,
    `setDueDate(time.dayStart(time.now()) + 8 * time.DAY - 1000);`,
  ],

  // 26. Detail Next Month button
  [
    `const d = new Date(); d.setMonth(d.getMonth() + 1); d.setHours(23, 59, 59, 999);
                setDueDate(d.getTime());`,
    `const dM = new Date(time.now()); dM.setMonth(dM.getMonth() + 1); dM.setHours(23, 59, 59, 999);
                setDueDate(dM.getTime());`,
  ],

  // 27. Start date Today button
  [
    `const d = new Date(); d.setHours(0,0,0,0); editStartAt = d.getTime(); if (selectedTaskId) updateField({ startAt: d.getTime() });`,
    `const dS = time.dayStart(time.now()); editStartAt = dS; if (selectedTaskId) updateField({ startAt: dS });`,
  ],

  // 28. Start date Tomorrow button
  [
    `const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); editStartAt = d.getTime(); if (selectedTaskId) updateField({ startAt: d.getTime() });`,
    `const dT = time.dayStart(time.now()) + time.DAY; editStartAt = dT; if (selectedTaskId) updateField({ startAt: dT });`,
  ],

  // 29. Activity timestamp — new Date(entry.timestamp).toLocaleTimeString(...)
  [
    `{new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    `{time.formatTime(entry.timestamp)}`,
  ],

  // 30. ShareSheet filename — new Date().toISOString().slice(0,10)
  [
    `filename={\`bento-tasks-\${new Date().toISOString().slice(0,10)}\`}`,
    `filename={\`bento-tasks-\${time.toISODate(time.now())}\`}`,
  ],

  // 31. reschedule log — new Date(d).toLocaleDateString(...)
  [
    `logActivityEntry(taskId, \`Rescheduled to \${new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} via overdue rescue\`).catch(() => {});`,
    "logActivityEntry(taskId, `Rescheduled to ${time.formatCustom(d.getTime(), 'M j')} via overdue rescue`).catch(() => {});",
  ],

  // 32. timelineGroups — new Date(task.dueAt).toISOString().slice(0, 10)
  [
    `const key = task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : 'No Date';`,
    `const key = task.dueAt ? time.toISODate(task.dueAt) : 'No Date';`,
  ],

  // 33. Reschedule NLP date construction — const d = new Date(now); d.setHours(...)
  [
    `const d = new Date(now);
          d.setHours(23, 59, 59, 999);
          if (action === 'tomorrow') d.setDate(d.getDate() + 1);
          else if (action === 'next-week') d.setDate(d.getDate() + 7);
          else if (action === 'next-month') d.setMonth(d.getMonth() + 1);`,
    `const d = new Date(nowMs2);
          d.setHours(23, 59, 59, 999);
          if (action === 'tomorrow') d.setDate(d.getDate() + 1);
          else if (action === 'next-week') d.setDate(d.getDate() + 7);
          else if (action === 'next-month') d.setMonth(d.getMonth() + 1);`,
  ],

  // 34. NLP parser d = new Date(now) for next week
  [
    `const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 59, 999);
      dueDateStr = d.toISOString();
      title = title.replace(nextWeekMatch[0], '');`,
    `const d = new Date(time.now());
      d.setDate(d.getDate() + 7);
      d.setHours(23, 59, 59, 999);
      dueDateStr = d.toISOString();
      title = title.replace(nextWeekMatch[0], '');`,
  ],
];

let count = 0;
for (const [oldStr, newStr] of replacements) {
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    count++;
    console.log(`✅ Applied: ${oldStr.substring(0, 60)}...`);
  } else {
    console.log(`⚠️  Not found: ${oldStr.substring(0, 60)}...`);
  }
}

if (content !== original) {
  writeFileSync(filePath, content, 'utf-8');
  console.log(`\n✅ Done! Applied ${count} replacements to tasks/App.svelte`);
} else {
  console.log(`\n⚠️  No changes made — content identical`);
}

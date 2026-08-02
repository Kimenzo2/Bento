<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { Plus, Command, Sun } from 'lucide-svelte';
  import { tooltip } from "$lib/components/Tooltip.svelte";

  let { onDismiss = () => {}, onCreateNote = () => {}, onOpenCommandPalette = () => {}, onOpenDailyNote = () => {} } = $props();

  let step = $state(0);
  let dismissed = $state(localStorage.getItem('getting-started-dismissed') === 'true');

  const steps = [
    { icon: Plus, title: 'Create your first note', desc: 'Press Ctrl+N or click the + button to create a new note and start writing.', action: 'Create note', handler: () => { onCreateNote(); } },
    { icon: Command, title: 'Try the command palette', desc: 'Press Ctrl+K to quickly search notes, run commands, and navigate.', action: 'Open palette', handler: () => { onOpenCommandPalette(); } },
    { icon: Sun, title: 'Open a daily note', desc: 'Press Ctrl+Shift+C to open the calendar and jump to any date.', action: 'Open daily note', handler: () => { onOpenDailyNote(); } },
  ];

  function next() {
    if (step < steps.length - 1) step++;
  }

  function skip() {
    localStorage.setItem('getting-started-dismissed', 'true');
    dismissed = true;
    onDismiss();
  }

  function handleAction() {
    const s = steps[step];
    s.handler();
    next();
  }
</script>

{#if !dismissed}
  <div class="gs-overlay" onclick={skip} role="presentation">
    <div class="gs-pane" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Getting started">
      <button class="gs-close" onclick={skip} type="button" aria-label="Dismiss" use:tooltip={{ text: "Dismiss" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <div class="gs-progress">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/>
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--primary)" stroke-width="3"
            stroke-dasharray="106.8" stroke-dashoffset={106.8 * (1 - (step + 1) / steps.length)}
            transform="rotate(-90 20 20)" style="transition: stroke-dashoffset 0.4s ease;"/>
        </svg>
        <span class="gs-step-num">{step + 1} / {steps.length}</span>
      </div>

      {#each steps as s, i}
        {#if i === step}
          <div class="gs-content">
            <s.icon size={32} strokeWidth={1.2} class="gs-icon" />
            <h2 class="gs-title">{s.title}</h2>
            <p class="gs-desc">{s.desc}</p>
            <div class="gs-actions">
              <button class="gs-btn primary" onclick={handleAction} type="button">{s.action}</button>
              <button class="gs-btn ghost" onclick={next} type="button">{step < steps.length - 1 ? 'Skip' : 'Finish'}</button>
            </div>
          </div>
        {/if}
      {/each}

      <div class="gs-dots">
        {#each steps as _, i}
          <span class="gs-dot" class:active={i === step}></span>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .gs-overlay { position: fixed; inset: 0; z-index: 9993; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--background) 60%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  .gs-pane { width: 340px; background: var(--background); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-md); padding: 32px 24px 20px; position: relative; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .gs-close { position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .gs-close:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .gs-progress { position: relative; display: flex; align-items: center; justify-content: center; }
  .gs-step-num { position: absolute; font-size: 11px; font-weight: 600; color: var(--muted); }
  .gs-content { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
  .gs-icon { color: var(--primary); opacity: 0.7; }
  .gs-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--foreground); }
  .gs-desc { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
  .gs-actions { display: flex; gap: 8px; margin-top: 8px; }
  .gs-btn { padding: 8px 20px; border: none; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 120ms ease; }
  .gs-btn.primary { background: var(--primary); color: white; }
  .gs-btn.primary:hover { opacity: 0.9; }
  .gs-btn.ghost { background: transparent; color: var(--muted); }
  .gs-btn.ghost:hover { color: var(--foreground); }
  .gs-dots { display: flex; gap: 6px; }
  .gs-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border); transition: all 200ms ease; }
  .gs-dot.active { background: var(--primary); transform: scale(1.3); }
</style>

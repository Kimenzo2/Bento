<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { X, Sun, Monitor, Moon, Type, Keyboard } from 'lucide-svelte';

  let { onClose = () => {} } = $props();

  let activeTab = $state<'general' | 'appearance' | 'shortcuts'>('general');
  let theme = $state(localStorage.getItem('bento-theme') || 'system');
  let fontFamily = $state(localStorage.getItem('notes-font') || 'Instrument Serif');
  let fontSize = $state(parseInt(localStorage.getItem('notes-font-size') || '16'));
  let defaultTemplateId = $state('');
  let templates = $state<any[]>([]);

  async function loadTemplates() {
    try { templates = await invoke<any[]>('notes_templates_list'); } catch { templates = []; }
  }

  function setTheme(t: string) {
    theme = t;
    localStorage.setItem('bento-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }

  function setFont(f: string) {
    fontFamily = f;
    localStorage.setItem('notes-font', f);
    window.dispatchEvent(new CustomEvent('notes:font-change', { detail: { font: f, size: fontSize } }));
  }

  function setFontSize(s: number) {
    fontSize = s;
    localStorage.setItem('notes-font-size', String(s));
    window.dispatchEvent(new CustomEvent('notes:font-change', { detail: { font: fontFamily, size: s } }));
  }

  $effect(() => { void loadTemplates(); });
</script>

<div class="settings-overlay" onclick={() => onClose()} role="presentation">
  <div class="settings" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
    <div class="settings-header">
      <span class="settings-title">Settings</span>
      <button class="settings-close" onclick={() => onClose()} type="button"><X size={14} /></button>
    </div>

    <div class="settings-tabs">
      <button class="settings-tab" class:active={activeTab === 'general'} onclick={() => activeTab = 'general'} type="button">General</button>
      <button class="settings-tab" class:active={activeTab === 'appearance'} onclick={() => activeTab = 'appearance'} type="button">Appearance</button>
      <button class="settings-tab" class:active={activeTab === 'shortcuts'} onclick={() => activeTab = 'shortcuts'} type="button">Shortcuts</button>
    </div>

    <div class="settings-body">
      {#if activeTab === 'general'}
        <div class="settings-section">
          <label class="settings-label">Default template for new notes</label>
          <select class="settings-select" bind:value={defaultTemplateId}>
            <option value="">None (blank note)</option>
            {#each templates as tpl (tpl.id)}
              <option value={tpl.id}>{tpl.icon} {tpl.name}</option>
            {/each}
          </select>
        </div>
      {:else if activeTab === 'appearance'}
        <div class="settings-section">
          <label class="settings-label">Theme</label>
          <div class="theme-options">
            <button class="theme-option" class:active={theme === 'light'} onclick={() => setTheme('light')} type="button">
              <Sun size={16} /> Light
            </button>
            <button class="theme-option" class:active={theme === 'dark'} onclick={() => setTheme('dark')} type="button">
              <Moon size={16} /> Dark
            </button>
            <button class="theme-option" class:active={theme === 'system'} onclick={() => setTheme('system')} type="button">
              <Monitor size={16} /> System
            </button>
          </div>
        </div>
        <div class="settings-section">
          <label class="settings-label">Editor font</label>
          <select class="settings-select" value={fontFamily} onchange={(e) => setFont(e.currentTarget.value)}>
            <option value="Instrument Serif">Instrument Serif</option>
            <option value="Inter">Inter</option>
            <option value="Georgia">Georgia</option>
            <option value="System UI">System UI</option>
            <option value="JetBrains Mono">JetBrains Mono</option>
          </select>
        </div>
        <div class="settings-section">
          <label class="settings-label">Font size: {fontSize}px</label>
          <input type="range" min="12" max="24" step="1" value={fontSize} oninput={(e) => setFontSize(parseInt(e.currentTarget.value))} class="settings-range" />
        </div>
      {:else if activeTab === 'shortcuts'}
        <div class="shortcuts-list">
          {#each [
            { key: 'Ctrl+N', desc: 'New note' },
            { key: 'Ctrl+K', desc: 'Command palette' },
            { key: 'Ctrl+F', desc: 'Find in note' },
            { key: 'Ctrl+Z', desc: 'Undo' },
            { key: 'Ctrl+Shift+Z / Ctrl+Y', desc: 'Redo' },
            { key: 'Ctrl+Shift+C', desc: 'Calendar' },
            { key: 'Ctrl+Shift+T', desc: 'Toggle tags pane' },
          ] as shortcut}
            <div class="shortcut-row">
              <span class="shortcut-desc">{shortcut.desc}</span>
              <kbd class="shortcut-key">{shortcut.key}</kbd>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .settings-overlay { position: fixed; inset: 0; z-index: 9996; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, #000 30%, transparent); }
  .settings { width: 420px; max-height: 520px; background: var(--background); border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; }
  .settings-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .settings-title { font-size: 14px; font-weight: 600; color: var(--foreground); }
  .settings-close { display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
  .settings-close:hover { background: color-mix(in srgb, var(--foreground) 6%, transparent); color: var(--foreground); }
  .settings-tabs { display: flex; gap: 2px; padding: 6px 10px 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .settings-tab { padding: 6px 14px; border: none; border-radius: 6px 6px 0 0; background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; transition: all 100ms ease; }
  .settings-tab:hover { color: var(--foreground); background: color-mix(in srgb, var(--foreground) 3%, transparent); }
  .settings-tab.active { color: var(--foreground); background: var(--background); font-weight: 600; margin-bottom: -1px; border: 1px solid var(--border); border-bottom: 1px solid var(--background); }
  .settings-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 16px; }
  .settings-section { display: flex; flex-direction: column; gap: 6px; }
  .settings-label { font-size: 12px; font-weight: 500; color: var(--foreground); }
  .settings-select { height: 32px; padding: 0 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--background); color: var(--foreground); font: inherit; font-size: 12px; outline: none; cursor: pointer; }
  .settings-select:focus { border-color: var(--primary); }
  .theme-options { display: flex; gap: 6px; }
  .theme-option { display: flex; align-items: center; gap: 6px; flex: 1; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--foreground); font: inherit; font-size: 12px; cursor: pointer; justify-content: center; transition: all 100ms ease; }
  .theme-option:hover { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .theme-option.active { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); }
  .settings-range { width: 100%; accent-color: var(--primary); }
  .shortcuts-list { display: flex; flex-direction: column; gap: 4px; }
  .shortcut-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; }
  .shortcut-row:hover { background: color-mix(in srgb, var(--foreground) 3%, transparent); }
  .shortcut-desc { font-size: 12px; color: var(--foreground); }
  .shortcut-key { display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border: 1px solid var(--border); border-radius: 4px; background: color-mix(in srgb, var(--foreground) 3%, transparent); font-family: inherit; font-size: 11px; color: var(--muted); }
</style>

<script lang="ts">
  import { Search, Copy, Pin, Clock, Type, Image as ImageIcon, Link2, Code, Trash2 } from 'lucide-svelte';

  export let moduleId: string;
  export let settings: any = {};
  void moduleId;
  void settings;

  let searchQuery = '';

  const pinnedClips = [
    { id: 'p1', type: 'code', content: 'npm install -D tailwindcss postcss autoprefixer', time: '2d ago', isPinned: true },
    { id: 'p2', type: 'text', content: '0x98fB...12aE (Wallet Address)', time: '1w ago', isPinned: true },
  ];

  const recentClips = [
    { id: '1', type: 'text', content: 'Meeting notes from today: Need to hit the Q3 metrics before we scale the marketing spend.', time: '2m ago', isPinned: false },
    { id: '2', type: 'link', content: 'https://github.com/Kimenzo/Bento/pulls', time: '15m ago', isPinned: false },
    { id: '3', type: 'image', content: 'Screenshot 2026-05-09 175836.png [1034x601]', time: '1h ago', isPinned: false },
    { id: '4', type: 'code', content: 'const app = express(); app.use(express.json());', time: '3h ago', isPinned: false },
    { id: '5', type: 'text', content: 'Check out the new design system specs attached.', time: '5h ago', isPinned: false },
  ];

  function getIcon(type: string) {
    if(type === 'code') return Code;
    if(type === 'link') return Link2;
    if(type === 'image') return ImageIcon;
    return Type;
  }

  function getIconColor(type: string) {
    if(type === 'code') return 'var(--clipboard-tone-code)';
    if(type === 'link') return 'var(--clipboard-tone-link)';
    if(type === 'image') return 'var(--clipboard-tone-image)';
    return 'var(--clipboard-tone-text)';
  }

  function copyAction(text: string) {
    console.log("Copied to clipboard:", text);
  }

  function handleKeyActivate(event: KeyboardEvent, callback: () => void) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  }
</script>

<div class="clipboard-app flat-ui module-root">
  <!-- Top Search Bar -->
  <div class="search-header">
    <div class="search-input-wrapper">
      <span class="search-icon"><Search size={20} /></span>
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Search clipboard history..."
      />
    </div>
  </div>

  <div class="clip-scroll-container">
    {#if !searchQuery}
      <!-- Pinned Section -->
      {#if pinnedClips.length > 0}
        <div class="section-title">
          <span class="pin-indicator-color"><Pin size={14} /></span>
          <span>Pinned</span>
        </div>
        <div class="clip-list">
          {#each pinnedClips as clip}
            <div class="clip-row" role="button" tabindex="0" on:click={() => copyAction(clip.content)} on:keydown={(event) => handleKeyActivate(event, () => copyAction(clip.content))}>
              <div class="clip-left">
                <div class="type-icon-wrapper" style="color: {getIconColor(clip.type)}">
                  <svelte:component this={getIcon(clip.type)} size={18} />
                </div>
              </div>
              <div class="clip-center">
                <span class="clip-content">{clip.content}</span>
              </div>
              <div class="clip-right">
                <span class="clip-time">{clip.time}</span>
                <button class="action-btn pinned" title="Unpin">
                  <Pin size={16} fill="currentColor" />
                </button>
                <button class="action-btn" title="Copy">
                  <Copy size={16} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <div class="section-title">
        <Clock size={14} />
        <span>Recent History</span>
      </div>
      <div class="clip-list">
        {#each recentClips as clip}
          <div class="clip-row" role="button" tabindex="0" on:click={() => copyAction(clip.content)} on:keydown={(event) => handleKeyActivate(event, () => copyAction(clip.content))}>
            <div class="clip-left">
              <div class="type-icon-wrapper" style="color: {getIconColor(clip.type)}">
                <svelte:component this={getIcon(clip.type)} size={18} />
              </div>
            </div>
            <div class="clip-center">
              <span class="clip-content">{clip.content}</span>
            </div>
            <div class="clip-right">
              <span class="clip-time">{clip.time}</span>
              <button class="action-btn" title="Pin">
                <Pin size={16} />
              </button>
              <button class="action-btn" title="Copy">
                <Copy size={16} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="section-title">
        <Search size={14} />
        <span>Search Results</span>
      </div>
      <!-- Mock search showing all for now -->
      <div class="clip-list">
        {#each [...pinnedClips, ...recentClips] as clip}
          <div class="clip-row" role="button" tabindex="0" on:click={() => copyAction(clip.content)} on:keydown={(event) => handleKeyActivate(event, () => copyAction(clip.content))}>
            <div class="clip-left">
              <div class="type-icon-wrapper" style="color: {getIconColor(clip.type)}">
                <svelte:component this={getIcon(clip.type)} size={18} />
              </div>
            </div>
            <div class="clip-center">
              <span class="clip-content">{clip.content}</span>
            </div>
            <div class="clip-right">
              <span class="clip-time">{clip.time}</span>
              <button class="action-btn" title="Copy">
                <Copy size={16} />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .clipboard-app.flat-ui {
    --clipboard-bg: var(--background);
    --clipboard-surface: color-mix(in srgb, var(--surface) 94%, var(--background));
    --clipboard-surface-strong: color-mix(in srgb, var(--surface) 82%, var(--background));
    --clipboard-ink: var(--foreground);
    --clipboard-muted: var(--muted);
    --clipboard-border: var(--border);
    --clipboard-accent: var(--primary);
    --clipboard-tone-code: color-mix(in srgb, var(--clipboard-accent) 80%, var(--clipboard-ink));
    --clipboard-tone-link: color-mix(in srgb, var(--accent) 72%, var(--clipboard-ink));
    --clipboard-tone-image: color-mix(in srgb, var(--clipboard-ink) 58%, var(--clipboard-surface));
    --clipboard-tone-text: color-mix(in srgb, var(--clipboard-accent) 62%, var(--clipboard-surface));
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--clipboard-bg);
    color: var(--clipboard-ink);
    font-family: inherit;
  }

  .search-header {
    padding: 24px 32px;
    background-color: var(--clipboard-surface-strong);
    border-bottom: 1px solid var(--clipboard-border);
    flex-shrink: 0;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    color: var(--clipboard-muted);
  }

  .search-input-wrapper input {
    width: 100%;
    background: var(--clipboard-bg);
    border: 1px solid var(--clipboard-border);
    color: var(--clipboard-ink);
    padding: 16px 16px 16px 48px;
    font-size: 16px;
    outline: none;
  }

  .search-input-wrapper input:focus {
    border-color: var(--clipboard-accent);
  }

  .search-input-wrapper input::placeholder {
    color: var(--clipboard-muted);
  }

  .clip-scroll-container {
    flex: 1;
    overflow-y: auto;
    padding: 0 32px 32px;
    background-color: var(--clipboard-bg);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--clipboard-muted);
    margin: 32px 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--clipboard-border);
  }

  .pin-indicator-color {
    color: var(--clipboard-tone-code);
  }

  .clip-list {
    display: flex;
    flex-direction: column;
  }

  .clip-row {
    display: flex;
    align-items: center;
    height: 56px;
    padding: 0 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--clipboard-border) 70%, transparent);
    cursor: default;
    background-color: var(--clipboard-bg);
  }

  .clip-row:hover {
    background-color: var(--clipboard-surface-strong);
  }

  .clip-left {
    width: 40px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .type-icon-wrapper {
    width: 32px;
    height: 32px;
    border: 1px solid var(--clipboard-border);
    background-color: var(--clipboard-surface-strong);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clip-center {
    flex: 1;
    min-width: 0;
    padding-right: 16px;
  }

  .clip-content {
    display: block;
    font-size: 14px;
    color: var(--clipboard-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "Space Mono", monospace;
  }

  .clip-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .clip-time {
    font-size: 12px;
    color: var(--clipboard-muted);
    min-width: 60px;
    text-align: right;
    margin-right: 8px;
  }

  .action-btn {
    background: transparent;
    border: 1px solid transparent;
    color: var(--clipboard-muted);
    padding: 6px;
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    background-color: var(--clipboard-surface-strong);
    color: var(--clipboard-ink);
  }

  .action-btn.pinned {
    color: var(--clipboard-tone-code);
  }
</style>



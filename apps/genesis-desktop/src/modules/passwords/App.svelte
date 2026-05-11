<script lang="ts">
  import { Search, Plus, Copy, ExternalLink, Eye, EyeOff } from 'lucide-svelte';

  export let moduleId: string;
  export let settings: any = {};

  // Mock State
  let searchQuery = '';
  type VaultEntry = {
    id: number;
    site: string;
    user: string;
    url: string;
    pass: string;
  };

  type VaultGroup = {
    section: string;
    items: VaultEntry[];
  };

  let showDetail: VaultEntry | null = null;
  let revealPassword = false;

  const categories = ["All", "Login", "Cards", "Notes", "Identity"];
  let activeCategory = "All";

  // Data
  const recentLogins: VaultEntry[] = [
    { id: 1, site: "GitHub", user: "kimenzo", url: "github.com", pass: "gh_token_9xV..." },
    { id: 2, site: "Stripe", user: "admin@corp.com", url: "stripe.com", pass: "str_live_..."},
    { id: 3, site: "AWS Console", user: "root-dev", url: "aws.amazon.com", pass: "aws_19192..."},
  ];

  const vault: VaultGroup[] = [
    { section: "A", items: [
      { id: 4, site: "Apple", user: "steve@mac.com", url: "apple.com", pass: "apple_xZ91..." },
      { id: 5, site: "Adobe", user: "design@ui.com", url: "adobe.com", pass: "dobe_pass..." },
    ]},
    { section: "G", items: [
      { id: 1, site: "GitHub", user: "kimenzo", url: "github.com", pass: "gh_token_9xV..." },
      { id: 6, site: "Google", user: "kimenzo@gmail.com", url: "google.com", pass: "g_99182..." },
    ]}
  ];

  function copyPass(pass: string) {
    // In real app, write to clipboard
    console.log("Copied:", pass);
  }

  function openDetail(item: VaultEntry) {
    showDetail = item;
    revealPassword = false;
  }
</script>

<div class="passwords-app-container module-root">
  
  <!-- Top: Search Bar -->
  <div class="search-header">
    <div class="add-action">
      <button class="icon-btn outline-btn"><Plus size={18} /></button>
    </div>
    <div class="search-wrapper">
      <Search size={20} class="search-icon" />
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Search passwords..." 
        autofocus
      />
    </div>
  </div>

  {#if !searchQuery}
    <!-- Categories -->
    <div class="categories-strip">
      {#each categories as cat}
        <button 
          class="cat-pill {activeCategory === cat ? 'active' : ''}"
          on:click={() => activeCategory = cat}
        >
          {cat}
        </button>
      {/each}
    </div>

    <div class="scrollable-content">
      
      <!-- Recently Used -->
      <section class="vault-section">
        <h3 class="section-title">Recently Used</h3>
        <div class="item-list">
          {#each recentLogins as entry}
            <div class="vault-item" on:click={() => openDetail(entry)}>
              <div class="item-left">
                <div class="favicon-circle">{entry.site.charAt(0)}</div>
                <div class="item-meta">
                  <span class="item-site">{entry.site}</span>
                  <span class="item-user">{entry.user}</span>
                </div>
              </div>
              <div class="item-right">
                <button class="action-btn" on:click|stopPropagation={() => copyPass(entry.pass)}>
                  <Copy size={16} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- Alphabetical List -->
      {#each vault as group}
        <section class="vault-section">
          <div class="alpha-header">{group.section}</div>
          <div class="item-list">
            {#each group.items as entry}
              <div class="vault-item" on:click={() => openDetail(entry)}>
                <div class="item-left">
                  <div class="favicon-circle">{entry.site.charAt(0)}</div>
                  <div class="item-meta">
                    <span class="item-site">{entry.site}</span>
                    <span class="item-user">{entry.user}</span>
                  </div>
                </div>
                <div class="item-right">
                  <button class="action-btn" on:click|stopPropagation={() => copyPass(entry.pass)}>
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/each}
      
    </div>

  {:else}
    <!-- Search Results View -->
    <div class="scrollable-content">
      <section class="vault-section">
        <h3 class="section-title">Search Results</h3>
        <!-- Just rendering recent items as mock results -->
        <div class="item-list">
          {#each recentLogins as entry}
            <div class="vault-item" on:click={() => openDetail(entry)}>
              <div class="item-left">
                <div class="favicon-circle">{entry.site.charAt(0)}</div>
                <div class="item-meta">
                  <span class="item-site">{entry.site}</span>
                  <span class="item-user">{entry.user}</span>
                </div>
              </div>
              <div class="item-right">
                <button class="action-btn" on:click|stopPropagation={() => copyPass(entry.pass)}>
                  <Copy size={16} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {/if}

  <!-- Detail Bottom Sheet / Slide Pane -->
  {#if showDetail}
    {@const detail = showDetail}
    <div class="detail-overlay" on:click={() => showDetail = null}>
      <div class="detail-pane" on:click|stopPropagation>
        
        <div class="pane-header">
          <div class="pane-title-wrap">
            <div class="favicon-circle large">{detail.site.charAt(0)}</div>
            <h2>{detail.site}</h2>
          </div>
          <button class="text-btn">Edit</button>
        </div>

        <div class="pane-body">
          <div class="field-block">
            <label>Username / Email</label>
            <div class="field-row">
              <span class="field-value">{detail.user}</span>
              <button class="action-btn"><Copy size={16}/></button>
            </div>
          </div>

          <div class="field-block">
            <label>Password</label>
            <div class="field-row">
              <span class="field-value password-font">
                {revealPassword ? detail.pass : '••••••••••••••••'}
              </span>
              <div class="field-actions">
                <button class="action-btn" on:click={() => revealPassword = !revealPassword}>
                  {#if revealPassword} <EyeOff size={16}/> {:else} <Eye size={16}/> {/if}
                </button>
                <button class="action-btn" on:click={() => copyPass(detail.pass)}>
                  <Copy size={16}/>
                </button>
              </div>
            </div>
          </div>

          <div class="field-block">
            <label>Website</label>
            <div class="field-row">
              <span class="field-value text-blue">{detail.url}</span>
              <button class="action-btn"><ExternalLink size={16}/></button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  {/if}

</div>

<style>
  .passwords-app-container {
    --vault-bg: var(--background);
    --vault-surface: color-mix(in srgb, var(--surface) 94%, var(--background));
    --vault-surface-strong: color-mix(in srgb, var(--surface) 84%, var(--background));
    --vault-ink: var(--foreground);
    --vault-muted: var(--muted);
    --vault-border: var(--border);
    --vault-accent: var(--primary);
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--vault-bg);
    color: var(--vault-ink);
    font-family: inherit;
    border-radius: 8px;
  }

  .search-header {
    display: flex;
    gap: 16px;
    padding: 24px 32px 16px;
    align-items: center;
    border-bottom: 1px solid var(--vault-border);
  }

  .search-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    color: var(--vault-muted);
  }

  .search-wrapper input {
    width: 100%;
    background: var(--vault-surface);
    border: 1px solid var(--vault-border);
    color: var(--vault-ink);
    padding: 14px 16px 14px 44px;
    border-radius: 8px;
    font-size: 16px;
    outline: none;
  }

  .search-wrapper input:focus {
    border-color: var(--vault-accent);
  }

  .search-wrapper input::placeholder {
    color: var(--vault-muted);
  }

  .icon-btn.outline-btn {
    background: transparent;
    border: 1px solid var(--vault-border);
    color: var(--vault-ink);
    width: 44px;
    height: 44px;
    border-radius: 8px;
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .categories-strip {
    display: flex;
    gap: 8px;
    padding: 16px 32px;
    border-bottom: 1px solid var(--vault-border);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .categories-strip::-webkit-scrollbar {
    display: none;
  }

  .cat-pill {
    background: var(--vault-surface);
    border: 1px solid var(--vault-border);
    color: var(--vault-muted);
    padding: 6px 16px;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 600;
    cursor: default;
    white-space: nowrap;
  }

  .cat-pill.active {
    background: var(--vault-ink);
    color: var(--vault-bg);
    border-color: color-mix(in srgb, var(--vault-ink) 68%, var(--vault-border));
  }

  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 32px 32px;
    scrollbar-width: none;
  }

  .scrollable-content::-webkit-scrollbar {
    display: none;
  }

  .vault-section {
    margin-top: 24px;
  }

  .section-title,
  .alpha-header {
    font-size: 14px;
    font-weight: 600;
    color: var(--vault-muted);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vault-border);
  }

  .alpha-header {
    font-size: 18px;
    color: var(--vault-accent);
    border-bottom: none;
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .vault-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-radius: 8px;
    cursor: default;
  }

  .vault-item:hover {
    background: var(--vault-surface-strong);
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .favicon-circle {
    width: 32px;
    height: 32px;
    border-radius: 16px;
    border: 1px solid var(--vault-border);
    background: var(--vault-surface-strong);
    color: var(--vault-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
  }

  .favicon-circle.large {
    width: 48px;
    height: 48px;
    border-radius: 24px;
    font-size: 20px;
  }

  .item-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-site {
    font-size: 15px;
    font-weight: 600;
    color: var(--vault-ink);
  }

  .item-user {
    font-size: 13px;
    color: var(--vault-muted);
  }

  .item-right {
    display: flex;
    align-items: center;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: var(--vault-muted);
    cursor: default;
    padding: 8px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    background: var(--vault-surface-strong);
    color: var(--vault-ink);
  }

  .detail-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--vault-bg) 62%, transparent);
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .detail-pane {
    width: 100%;
    max-width: 600px;
    background: var(--vault-bg);
    border: 1px solid var(--vault-border);
    border-radius: 16px 16px 0 0;
    padding: 32px;
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--vault-border);
  }

  .pane-title-wrap {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .pane-title-wrap h2 {
    font-size: 24px;
    margin: 0;
    color: var(--vault-ink);
  }

  .text-btn {
    background: transparent;
    border: none;
    color: var(--vault-accent);
    font-weight: 600;
    font-size: 15px;
    cursor: default;
  }

  .pane-body {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .field-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-block label {
    font-size: 12px;
    font-weight: 600;
    color: var(--vault-muted);
    text-transform: uppercase;
  }

  .field-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--vault-surface);
    border: 1px solid var(--vault-border);
    padding: 12px 16px;
    border-radius: 8px;
  }

  .field-value {
    font-size: 16px;
    color: var(--vault-ink);
  }

  .password-font {
    font-family: "Space Mono", monospace;
    letter-spacing: 0.1em;
  }

  .text-blue {
    color: var(--vault-accent);
    cursor: default;
    text-decoration: underline;
  }

  .field-actions {
    display: flex;
    gap: 4px;
  }
</style>



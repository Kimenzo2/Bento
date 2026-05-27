<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { fade, slide } from "svelte/transition";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { time } from "$lib/utils/time";
  import { invoke } from "@tauri-apps/api/core";

  let _t = $derived.by(() => createTranslator($activeBundle));

  let t = (key: string, fallback?: string) => _t(key, fallback);

  type VaultEntry = {
    id: string;
    site: string;
    username: string;
    password: string;
    notes: string;
    created: number;
    updated: number;
  };

  let entries = $state<VaultEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let search = $state("");
  let showForm = $state(false);
  let formSite = $state("");
  let formUser = $state("");
  let formPass = $state("");
  let formNotes = $state("");
  let editingId = $state<string | null>(null);
  let visiblePasswords = $state<Set<string>>(new Set());
  let copiedId = $state<string | null>(null);
  let useBackend = $state(false);

  const STORAGE_KEY = "bento_passwords";

  // ── Helpers ────────────────────────────────────────────────────────────────

  function normalizeEntry(entry: Partial<VaultEntry>): VaultEntry | null {
    if (!entry.id || !entry.site || !entry.username || !entry.password) return null;
    const now = time.now();

    return {
      id: String(entry.id),
      site: String(entry.site).trim(),
      username: String(entry.username).trim(),
      password: String(entry.password),
      notes: String(entry.notes ?? "").trim(),
      created: Number(entry.created ?? now),
      updated: Number(entry.updated ?? entry.created ?? now),
    };
  }

  function loadFromLocalStorage(): VaultEntry[] {
    const raw = browser ? localStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .map((e: Partial<VaultEntry>) => normalizeEntry(e))
          .filter((e: VaultEntry | null): e is VaultEntry => Boolean(e))
          .sort((a: VaultEntry, b: VaultEntry) => b.updated - a.updated || b.created - a.created)
      : [];
  }

  function persistLocalStorage() {
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  // ── Data layer ──────────────────────────────────────────────────────────────

  async function load() {
    loading = true;
    error = null;

    // Try the encrypted backend first (requires master password unlocked)
    try {
      let backend = await invoke<VaultEntry[]>("passwords_list");

      // Backend is available — auto-migrate any localStorage data
      const localRaw = browser ? localStorage.getItem(STORAGE_KEY) : null;
      if (localRaw) {
        try {
          const count = await invoke<number>("passwords_migrate_from_storage", { entriesJson: localRaw });
          if (count > 0) {
            console.log(`[passwords] migrated ${count} entries from localStorage to encrypted DB`);
          }
          localStorage.removeItem(STORAGE_KEY);
          // Re-read after migration so entries reflect merged data
          backend = await invoke<VaultEntry[]>("passwords_list");
        } catch (e) {
          console.warn("[passwords] migration from localStorage to encrypted DB failed", e);
        }
      }

      entries = backend;
      useBackend = true;
    } catch {
      // Backend unavailable (crypto locked or not configured) — use localStorage
      try {
        entries = loadFromLocalStorage();
      } catch (e) {
        error = _t("modulePasswordsErrorLoad", "Failed to load vault");
        entries = [];
      }
      useBackend = false;
    } finally {
      loading = false;
    }
  }

  async function saveToBackend(entry: VaultEntry): Promise<void> {
    try {
      await invoke("passwords_save", { entry });
      // Re-read so we're always in sync (sort order, timestamps from server)
      entries = await invoke<VaultEntry[]>("passwords_list");
    } catch (e) {
      console.warn("[passwords] save to encrypted backend failed, falling back", e);
      useBackend = false;
      entries = loadFromLocalStorage();
    }
  }

  async function deleteFromBackend(id: string): Promise<void> {
    try {
      await invoke("passwords_delete", { id });
      entries = await invoke<VaultEntry[]>("passwords_list");
    } catch (e) {
      console.warn("[passwords] delete from encrypted backend failed, falling back", e);
      useBackend = false;
      entries = loadFromLocalStorage();
    }
  }

  // ── UI actions ─────────────────────────────────────────────────────────────

  function resetForm() {
    formSite = "";
    formUser = "";
    formPass = "";
    formNotes = "";
    editingId = null;
    showForm = false;
  }

  async function saveEntry() {
    if (!formSite.trim() || !formUser.trim() || !formPass.trim()) return;

    if (useBackend) {
      if (editingId) {
        const patched: VaultEntry = {
          id: editingId,
          site: formSite.trim(),
          username: formUser.trim(),
          password: formPass.trim(),
          notes: formNotes.trim(),
          created: entries.find((e) => e.id === editingId)?.created ?? time.now(),
          updated: time.now(),
        };
        await saveToBackend(patched);
      } else {
        const created = time.now();
        const newEntry: VaultEntry = {
          id: crypto.randomUUID(),
          site: formSite.trim(),
          username: formUser.trim(),
          password: formPass.trim(),
          notes: formNotes.trim(),
          created,
          updated: created,
        };
        await saveToBackend(newEntry);
      }
    } else {
      if (editingId) {
        entries = entries.map((e) =>
          e.id === editingId
            ? { ...e, site: formSite.trim(), username: formUser.trim(), password: formPass.trim(), notes: formNotes.trim(), updated: time.now() }
            : e
        );
      } else {
        entries = [
          { id: crypto.randomUUID(), site: formSite.trim(), username: formUser.trim(), password: formPass.trim(), notes: formNotes.trim(), created: time.now(), updated: time.now() },
          ...entries,
        ];
      }
      entries = entries.sort((a, b) => b.updated - a.updated || b.created - a.created);
      persistLocalStorage();
    }

    resetForm();
  }

  function editEntry(entry: VaultEntry) {
    formSite = entry.site;
    formUser = entry.username;
    formPass = entry.password;
    formNotes = entry.notes;
    editingId = entry.id;
    showForm = true;
  }

  async function deleteEntry(id: string) {
    if (useBackend) {
      await deleteFromBackend(id);
    } else {
      entries = entries.filter((e) => e.id !== id);
      persistLocalStorage();
    }
  }

  async function copyPassword(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = id;
      setTimeout(() => (copiedId = null), 1500);
    } catch {}
  }

  function toggleVisible(id: string) {
    const next = new Set(visiblePasswords);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    visiblePasswords = next;
  }

  function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let pw = "";
    for (let i = 0; i < 20; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    formPass = pw;
  }

  const filtered = $derived(
    search.trim()
      ? entries.filter(
          (e) =>
            e.site.toLowerCase().includes(search.toLowerCase()) ||
            e.username.toLowerCase().includes(search.toLowerCase())
        )
      : entries
  );

  const totalPasswords = $derived(entries.length);

  onMount(() => load());
</script>

<div class="vault-shell module-root" data-module="passwords">
  <!-- Header -->
  <div class="vault-header">
    <div class="vault-header-left">
      <span class="vault-icon">🔒</span>
      <div>
        <h1 class="vault-title">{_t("modulePasswordsTitle", "Password Vault")}</h1>
        <p class="vault-subtitle">
          {_t("modulePasswordsTotal", "{n} passwords saved").replace("{n}", String(totalPasswords))}
          {#if useBackend}
            <span class="vault-badge">E2EE</span>
          {/if}
        </p>
      </div>
    </div>
    <button class="vault-btn vault-btn-primary" onclick={() => { resetForm(); showForm = true; }}>
      + {_t("modulePasswordsAddPassword", "Add Password")}
    </button>
  </div>

  <!-- Search -->
  {#if entries.length > 0}
    <div class="vault-search" transition:fade>
      <input
        type="text"
        class="vault-input"
        bind:value={search}
        placeholder={_t("modulePasswordsSearchPlaceholder", "Search sites or usernames...")}
      />
    </div>
  {/if}

  <!-- Loading -->
  {#if loading}
    <div class="vault-loading" transition:fade>
      {#each [1, 2, 3, 4] as _}
        <div class="vault-skeleton"></div>
      {/each}
    </div>

  <!-- Error -->
  {:else if error}
    <div class="vault-state vault-state-error" transition:fade>
      <span class="vault-state-icon">⚠️</span>
      <p>{error}</p>
      <button class="vault-btn vault-btn-secondary" onclick={load}>Retry</button>
    </div>

  <!-- Empty -->
  {:else if entries.length === 0}
    <div class="vault-state" transition:fade>
      <span class="vault-state-icon vault-state-icon--large">🔒</span>
      <h2 class="vault-state-title">{_t("modulePasswordsNoVault", "Your vault is empty")}</h2>
      <p class="vault-state-desc">{_t("modulePasswordsNoVaultDesc", "Save your first password to get started.")}</p>
      <button class="vault-btn vault-btn-primary" onclick={() => { resetForm(); showForm = true; }}>
        {_t("modulePasswordsAddFirst", "Add Your First Password")}
      </button>
    </div>

  <!-- Add/Edit Form -->
  {/if}

  {#if showForm}
    <div class="vault-form-overlay" transition:fade onclick={resetForm} role="presentation"></div>
    <div class="vault-form-panel" transition:fade={{ duration: 150 }}>
      <h2 class="vault-form-title">{editingId ? _t("modulePasswordsEditPassword", "Edit Password") : _t("modulePasswordsAddPassword", "Add Password")}</h2>
      <div class="vault-form-group">
        <label class="vault-label">{_t("modulePasswordsSiteLabel", "Site / App")}</label>
        <input type="text" class="vault-input" bind:value={formSite} placeholder="e.g. github.com" />
      </div>
      <div class="vault-form-group">
        <label class="vault-label">{_t("modulePasswordsUsernameLabel", "Username / Email")}</label>
        <input type="text" class="vault-input" bind:value={formUser} placeholder="user@example.com" />
      </div>
      <div class="vault-form-group">
        <label class="vault-label">{_t("modulePasswordsPasswordLabel", "Password")}</label>
        <div class="vault-pass-row">
          <input type="text" class="vault-input" bind:value={formPass} placeholder="Enter or generate" />
          <button class="vault-btn vault-btn-ghost vault-btn-sm" onclick={generatePassword} title={_t("modulePasswordsGenerate", "Generate")}>🎲</button>
        </div>
      </div>
      <div class="vault-form-group">
        <label class="vault-label">{_t("modulePasswordsNotesLabel", "Notes (optional)")}</label>
        <textarea class="vault-textarea" bind:value={formNotes} placeholder="Any extra info..." rows={2}></textarea>
      </div>
      <div class="vault-form-actions">
        <button class="vault-btn vault-btn-primary" disabled={!formSite.trim() || !formUser.trim() || !formPass.trim()} onclick={saveEntry}>
          {editingId ? _t("modulePasswordsUpdate", "Update Password") : _t("modulePasswordsSave", "Save Password")}
        </button>
        <button class="vault-btn vault-btn-ghost" onclick={resetForm}>{_t("commonCancel", "Cancel")}</button>
      </div>
    </div>
  {/if}

  <!-- List -->
  {#if !loading && !error && entries.length > 0}
    <div class="vault-list" transition:fade>
      {#if filtered.length === 0}
        <div class="vault-state" transition:fade>
          <span class="vault-state-icon">🔍</span>
          <p class="vault-state-desc">{_t("modulePasswordsNoResults", "No results for \"{q}\"").replace("{q}", search)}</p>
        </div>
      {/if}
      {#each filtered as entry (entry.id)}
        <div class="vault-row" transition:slide={{ duration: 150 }}>
          <div class="vault-row-left">
            <div class="vault-row-icon">{entry.site.charAt(0).toUpperCase()}</div>
            <div class="vault-row-info">
              <span class="vault-row-site">{entry.site}</span>
              <span class="vault-row-user">{entry.username}</span>
            </div>
          </div>
          <div class="vault-pass-display">
            {#if visiblePasswords.has(entry.id)}
              <span class="vault-pass-text">{entry.password}</span>
            {:else}
              <span class="vault-pass-dots">{'•'.repeat(Math.min(entry.password.length, 20))}</span>
            {/if}
            <button class="vault-btn-icon" onclick={() => toggleVisible(entry.id)} title={visiblePasswords.has(entry.id) ? _t("commonHide", "Hide") : _t("commonShow", "Show")}>
              {visiblePasswords.has(entry.id) ? "🙈" : "👁️"}
            </button>
          </div>
          <div class="vault-row-actions">
            <button class="vault-btn-icon" onclick={() => copyPassword(entry.password, entry.id)} title={_t("commonCopy", "Copy")}>
              {copiedId === entry.id ? "✅" : "📋"}
            </button>
            <button class="vault-btn-icon" onclick={() => editEntry(entry)} title={_t("commonEdit", "Edit")}>✏️</button>
            <button class="vault-btn-icon vault-btn-icon--danger" onclick={() => deleteEntry(entry.id)} title={_t("commonDelete", "Delete")}>🗑️</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .vault-shell {
    --vault-surface: var(--card);
    --vault-surface-soft: color-mix(in srgb, var(--surface) 94%, var(--background));
    --vault-surface-hover: color-mix(in srgb, var(--foreground) 8%, var(--card));
    --vault-border: color-mix(in srgb, var(--border) 86%, transparent);
    --vault-ink: var(--foreground);
    --vault-muted: var(--muted);
    --vault-subtle: color-mix(in srgb, var(--muted) 62%, transparent);
    --vault-accent: var(--primary);
    --vault-accent-foreground: var(--primary-foreground, var(--background));
    --vault-danger: var(--destructive, var(--primary));
    padding: 24px;
    max-width: 720px;
    margin: 0 auto;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
  }

  .vault-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .vault-header-left { display: flex; align-items: center; gap: 12px; }
  .vault-icon { font-size: 28px; line-height: 1; }
  .vault-title { font-size: 20px; font-weight: 700; margin: 0; color: var(--vault-ink); }
  .vault-subtitle { font-size: 13px; color: var(--vault-muted); margin: 2px 0 0 0; display: flex; align-items: center; gap: 8px; }

  .vault-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--vault-accent) 18%, transparent);
    color: var(--vault-accent);
    text-transform: uppercase;
  }

  .vault-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 12px;
    padding: 60px 20px;
  }
  .vault-state-error { gap: 8px; }
  .vault-state-icon { font-size: 24px; }
  .vault-state-icon--large { font-size: 48px; }
  .vault-state-title { font-size: 18px; font-weight: 600; margin: 0; color: var(--vault-ink); }
  .vault-state-desc { font-size: 14px; color: var(--vault-muted); margin: 0; max-width: 280px; }

  .vault-loading { display: flex; flex-direction: column; gap: 10px; }
  .vault-skeleton {
    height: 56px;
    border-radius: 10px;
    background: var(--vault-surface-soft);
    animation: vault-pulse 1.5s infinite;
  }
  @keyframes vault-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

  .vault-btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .vault-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .vault-btn-primary { background: var(--vault-accent); color: var(--vault-accent-foreground); }
  .vault-btn-primary:not(:disabled):hover { opacity: 0.9; transform: translateY(-1px); }
  .vault-btn-secondary { background: var(--vault-surface-soft); color: var(--vault-ink); }
  .vault-btn-secondary:not(:disabled):hover { background: var(--vault-surface-hover); }
  .vault-btn-ghost { background: transparent; color: var(--vault-muted); padding: 6px 12px; }
  .vault-btn-ghost:hover { background: var(--vault-surface-hover); }
  .vault-btn-sm { padding: 5px 10px; font-size: 12px; }

  .vault-btn-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    background: transparent;
    transition: all 0.15s;
  }
  .vault-btn-icon:hover { background: var(--vault-surface-hover); }
  .vault-btn-icon--danger { color: var(--vault-danger); }
  .vault-btn-icon--danger:hover { background: color-mix(in srgb, var(--vault-danger) 12%, transparent); }

  .vault-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--vault-border);
    background: var(--vault-surface-soft);
    color: var(--vault-ink);
    font-size: 14px;
    outline: none;
    transition: border 0.15s;
    box-sizing: border-box;
  }
  .vault-input:focus { border-color: var(--vault-accent); box-shadow: none; }
  .vault-input::placeholder { color: var(--vault-subtle); }

  .vault-textarea {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--vault-border);
    background: var(--vault-surface-soft);
    color: var(--vault-ink);
    font-size: 14px;
    outline: none;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
  }
  .vault-textarea:focus { border-color: var(--vault-accent); box-shadow: none; }

  .vault-pass-row { display: flex; gap: 6px; }
  .vault-pass-row input { flex: 1; }

  .vault-list { display: flex; flex-direction: column; gap: 6px; }

  .vault-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 20px;
    background: var(--vault-surface);
    border: 1px solid var(--vault-border);
    box-shadow: none;
    transition: all 0.15s;
  }
  .vault-row:hover { background: var(--vault-surface-hover); }

  .vault-row-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }

  .vault-row-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--vault-accent) 12%, transparent);
    color: var(--vault-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
  }

  .vault-row-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .vault-row-site { font-size: 14px; font-weight: 600; color: var(--vault-ink); }
  .vault-row-user { font-size: 12px; color: var(--vault-muted); }

  .vault-pass-display { display: flex; align-items: center; gap: 6px; }
  .vault-pass-text { font-size: 13px; font-family: monospace; color: var(--vault-ink); }
  .vault-pass-dots { font-size: 18px; letter-spacing: 2px; color: var(--vault-subtle); }

  .vault-row-actions { display: flex; gap: 2px; }

  .vault-form-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--background) 72%, transparent);
    z-index: 100;
  }

  .vault-form-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 101;
    background: var(--vault-surface);
    border: 1px solid var(--vault-border);
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 80vh;
    width: min(440px, 90vw);
    overflow-y: auto;
    box-shadow: none;
  }

  .vault-form-title { font-size: 17px; font-weight: 700; margin: 0; color: var(--vault-ink); }
  .vault-form-group { display: flex; flex-direction: column; gap: 6px; }
  .vault-label { font-size: 13px; font-weight: 600; color: var(--vault-ink); }
  .vault-form-actions { display: flex; gap: 8px; margin-top: 4px; }
</style>

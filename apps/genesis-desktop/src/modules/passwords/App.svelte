<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import "./passwords.css";
  import type { VaultEntry, VaultFormData } from "./types";

  let { moduleId = "passwords", settings = {} }: { moduleId?: string; settings?: Record<string, unknown> } = $props();

  // ── State ─────────────────────────────────────────────────────

  let entries = $state<VaultEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let selectedEntry = $state<VaultEntry | null>(null);
  let showForm = $state(false);
  let formData = $state<VaultFormData>({ site: "", username: "", password: "", notes: "" });
  let editingId = $state<string | null>(null);
  let visiblePasswords = $state<Set<string>>(new Set());
  let copiedId = $state<string | null>(null);
  let saving = $state(false);

  // ── Load entries ──────────────────────────────────────────────

  async function loadEntries() {
    loading = true;
    error = null;
    try {
      entries = await invoke<VaultEntry[]>("passwords_list");
    } catch (e) {
      error = String(e);
      entries = [];
    } finally {
      loading = false;
    }
  }

  onMount(loadEntries);

  // ── Search ─────────────────────────────────────────────────────

  let searchResults = $state<VaultEntry[]>([]);

  async function doSearch() {
    const q = searchQuery.trim();
    if (!q) {
      searchResults = [];
      return;
    }
    try {
      searchResults = await invoke<VaultEntry[]>("passwords_search", { query: q });
    } catch {
      searchResults = [];
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────

  function openAddForm() {
    editingId = null;
    formData = { site: "", username: "", password: "", notes: "" };
    showForm = true;
  }

  function openEditForm(entry: VaultEntry) {
    editingId = entry.id;
    formData = {
      site: entry.site,
      username: entry.username,
      password: entry.password,
      notes: entry.notes,
    };
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editingId = null;
  }

  async function saveEntry() {
    if (!formData.site.trim() || !formData.username.trim() || !formData.password.trim()) return;
    saving = true;
    try {
      const now = Date.now();
      const entry: VaultEntry = {
        id: editingId ?? crypto.randomUUID(),
        site: formData.site.trim(),
        username: formData.username.trim(),
        password: formData.password,
        notes: formData.notes.trim(),
        created: editingId ? (entries.find(e => e.id === editingId)?.created ?? now) : now,
        updated: now,
      };
      await invoke("passwords_save", { entry });
      closeForm();
      await loadEntries();
    } catch (e) {
      error = String(e);
    } finally {
      saving = false;
    }
  }

  async function deleteEntry(id: string) {
    try {
      await invoke("passwords_delete", { id });
      if (selectedEntry?.id === id) selectedEntry = null;
      entries = entries.filter(e => e.id !== id);
    } catch (e) {
      error = String(e);
    }
  }

  // ── Utilities ─────────────────────────────────────────────────

  function togglePassword(id: string) {
    if (visiblePasswords.has(id)) visiblePasswords.delete(id);
    else visiblePasswords.add(id);
    visiblePasswords = new Set(visiblePasswords);
  }

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = id;
      setTimeout(() => { copiedId = null; }, 1500);
    } catch {}
  }

  function groupEntries(entries: VaultEntry[]): Map<string, VaultEntry[]> {
    const groups = new Map<string, VaultEntry[]>();
    for (const e of entries) {
      const letter = e.site.charAt(0).toUpperCase();
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(e);
    }
    return groups;
  }

  const displayEntries = $derived(searchQuery.trim() ? searchResults : entries);
  const grouped = $derived(groupEntries(displayEntries));
  const sortedGroups = $derived([...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])));

  // ── Derived stats ──────────────────────────────────────────────

  const totalEntries = $derived(entries.length);
  const strongEntries = $derived(entries.filter(e => e.password.length >= 12).length);
</script>

<div class="pv-app">
  <!-- Header -->
  <header class="pv-header">
    <div class="pv-header-top">
      <div class="pv-header-info">
        <span class="pv-eyebrow">Vault</span>
        <h1 class="pv-title">Passwords</h1>
      </div>
      <button class="pv-add-btn" onclick={openAddForm} aria-label="Add entry">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>New</span>
      </button>
    </div>
    <p class="pv-desc">Encrypted credentials stored locally on this device.</p>
  </header>

  <!-- Stats bar -->
  <div class="pv-stats">
    <div class="pv-stat">
      <span class="pv-stat-value">{totalEntries}</span>
      <span class="pv-stat-label">Saved</span>
    </div>
    <div class="pv-stat">
      <span class="pv-stat-value">{strongEntries}</span>
      <span class="pv-stat-label">Strong</span>
    </div>
  </div>

  <!-- Search -->
  <div class="pv-search-wrap">
    <svg class="pv-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input
      class="pv-search-input"
      type="text"
      placeholder="Search sites or usernames…"
      bind:value={searchQuery}
      oninput={doSearch}
    />
    {#if searchQuery}
      <button class="pv-search-clear" onclick={() => { searchQuery = ""; searchResults = []; }} aria-label="Clear search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    {/if}
  </div>

  <!-- Content area -->
  <div class="pv-content">
    {#if loading}
      <div class="pv-state">
        <div class="pv-spinner"></div>
        <p>Loading vault…</p>
      </div>
    {:else if error}
      <div class="pv-state pv-state-error">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>Failed to load vault: {error}</p>
        <button class="pv-retry-btn" onclick={loadEntries}>Retry</button>
      </div>
    {:else if displayEntries.length === 0}
      <div class="pv-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        {#if searchQuery}
          <p>No results for "{searchQuery}"</p>
        {:else}
          <p>Your vault is empty</p>
          <button class="pv-retry-btn" onclick={openAddForm}>Add your first entry</button>
        {/if}
      </div>
    {:else}
      <div class="pv-list">
        {#each sortedGroups as [letter, items]}
          <div class="pv-group">
            <span class="pv-group-letter">{letter}</span>
            {#each items as entry (entry.id)}
              <div
                class="pv-item"
                class:pv-item-selected={selectedEntry?.id === entry.id}
                role="button"
                tabindex="0"
                onclick={() => selectedEntry = selectedEntry?.id === entry.id ? null : entry}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedEntry = selectedEntry?.id === entry.id ? null : entry; } }}
              >
                <span class="pv-item-avatar">{entry.site.charAt(0).toUpperCase()}</span>
                <span class="pv-item-info">
                  <span class="pv-item-site">{entry.site}</span>
                  <span class="pv-item-user">{entry.username}</span>
                </span>
                <span class="pv-item-actions" onclick={(e) => e.stopPropagation()}>
                  <button class="pv-icon-btn" onclick={() => copyText(entry.password, `copy-${entry.id}`)} aria-label="Copy password">
                    {#if copiedId === `copy-${entry.id}`}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {:else}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    {/if}
                  </button>
                  <button class="pv-icon-btn" onclick={() => openEditForm(entry)} aria-label="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                  </button>
                </span>
              </div>

              <!-- Expanded detail pane -->
              {#if selectedEntry?.id === entry.id}
                <div class="pv-detail">
                  <div class="pv-detail-field">
                    <span class="pv-detail-label">Username</span>
                    <div class="pv-detail-row">
                      <span class="pv-detail-value">{entry.username}</span>
                      <button class="pv-icon-btn" onclick={() => copyText(entry.username, `user-${entry.id}`)} aria-label="Copy username">
                        {#if copiedId === `user-${entry.id}`}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {:else}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        {/if}
                      </button>
                    </div>
                  </div>

                  <div class="pv-detail-field">
                    <span class="pv-detail-label">Password</span>
                    <div class="pv-detail-row">
                      <span class="pv-detail-value pv-detail-value--mono">
                        {visiblePasswords.has(entry.id) ? entry.password : "•".repeat(Math.min(entry.password.length, 24))}
                      </span>
                      <span class="pv-detail-actions">
                        <button class="pv-icon-btn" onclick={() => togglePassword(entry.id)} aria-label={visiblePasswords.has(entry.id) ? "Hide" : "Show"}>
                          {#if visiblePasswords.has(entry.id)}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          {:else}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          {/if}
                        </button>
                        <button class="pv-icon-btn" onclick={() => copyText(entry.password, `pass-${entry.id}`)} aria-label="Copy password">
                          {#if copiedId === `pass-${entry.id}`}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {:else}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          {/if}
                        </button>
                      </span>
                    </div>
                  </div>

                  {#if entry.notes}
                    <div class="pv-detail-field">
                      <span class="pv-detail-label">Notes</span>
                      <p class="pv-detail-notes">{entry.notes}</p>
                    </div>
                  {/if}

                  <div class="pv-detail-footer">
                    <button class="pv-delete-btn" onclick={() => deleteEntry(entry.id)} aria-label="Delete entry">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Delete
                    </button>
                    <button class="pv-edit-btn" onclick={() => openEditForm(entry)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                      Edit
                    </button>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Add/Edit modal -->
{#if showForm}
  <div class="pv-modal-overlay" role="presentation" onclick={closeForm}>
    <div class="pv-modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-label={editingId ? "Edit entry" : "New entry"}>
      <div class="pv-modal-header">
        <h2 class="pv-modal-title">{editingId ? "Edit entry" : "New entry"}</h2>
        <button class="pv-icon-btn" onclick={closeForm} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="pv-modal-body">
        <label class="pv-field">
          <span class="pv-field-label">Site</span>
          <input class="pv-input" type="text" placeholder="e.g. GitHub" bind:value={formData.site} />
        </label>
        <label class="pv-field">
          <span class="pv-field-label">Username</span>
          <input class="pv-input" type="text" placeholder="e.g. user@email.com" bind:value={formData.username} />
        </label>
        <label class="pv-field">
          <span class="pv-field-label">Password</span>
          <input class="pv-input pv-input--mono" type="text" placeholder="Enter password" bind:value={formData.password} />
        </label>
        <label class="pv-field">
          <span class="pv-field-label">Notes</span>
          <textarea class="pv-textarea" placeholder="Optional notes…" bind:value={formData.notes} rows={3}></textarea>
        </label>
      </div>
      <div class="pv-modal-footer">
        <button class="pv-btn pv-btn-cancel" onclick={closeForm}>Cancel</button>
        <button
          class="pv-btn pv-btn-save"
          onclick={saveEntry}
          disabled={!formData.site.trim() || !formData.username.trim() || !formData.password.trim() || saving}
        >
          {saving ? "Saving…" : editingId ? "Save changes" : "Add entry"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .pv-eyebrow {
    font-size: 0.82rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--muted);
  }
  .pv-title {
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 2.5vw, 2.6rem);
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin: 0;
    color: var(--foreground);
  }
  .pv-desc {
    font-size: 0.97rem;
    line-height: 1.55;
    color: var(--muted);
    margin: 0;
  }
</style>

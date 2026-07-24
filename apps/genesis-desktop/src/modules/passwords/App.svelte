<script lang="ts">
  import { tick } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { toast } from "svelte-sonner";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { sanitizeError } from "$lib/utils/logger";
  import { ensureModuleSection, getModuleSectionLabel, moduleSectionStore } from "$lib/stores/module-sections.store";
  import type { VaultEntry } from "./types";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import WandSparklesIcon from "@lucide/svelte/icons/wand-sparkles";
  import SearchIcon from "@lucide/svelte/icons/search";
  import XIcon from "@lucide/svelte/icons/x";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import Edit2Icon from "@lucide/svelte/icons/edit-2";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import LockIcon from "@lucide/svelte/icons/lock";
  import HeartIcon from "@lucide/svelte/icons/heart";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import PlaneIcon from "@lucide/svelte/icons/plane";
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import CheckIcon from "@lucide/svelte/icons/check";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { tooltip } from "$lib/components/Tooltip.svelte";

  const moduleId = "passwords";
  const sectionLabels = ["Vault", "Health", "Passkeys", "Secure Notes", "Travel Mode", "Audit"] as const;
  let selectedSection = $derived(getModuleSectionLabel($moduleSectionStore, moduleId, sectionLabels));

  let _t = $derived.by(() => createTranslator($activeBundle));

  let entries = $state.raw<VaultEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let searchError = $state<string | null>(null);
  let selectedEntry = $state<VaultEntry | null>(null);
  let dialogOpen = $state(false);
  let confirmOpen = $state(false);
  let confirmAction = $state<(() => void) | null>(null);
  let confirmMessage = $state("");
  let formData = $state({ site: "", username: "", password: "", notes: "" });
  let editingId = $state<string | null>(null);
  let visiblePasswords = $state<Record<string, boolean>>({});
  let copiedId = $state<string | null>(null);
  let saving = $state(false);
  let formDirty = $state(false);
  let showFormPassword = $state(false);
  let firstInput = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let searchResults = $state.raw<VaultEntry[]>([]);
  let searchLoading = $state(false);

  async function loadEntries() {
    loading = true;
    error = null;
    try {
      entries = await invoke<VaultEntry[]>("passwords_list");
    } catch (e) {
      error = sanitizeError(String(e));
      entries = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    ensureModuleSection(moduleId, sectionLabels);
    loadEntries();
  });

  function doSearch() {
    const q = searchQuery.trim();
    searchError = null;
    if (!q) {
      searchResults = [];
      searchLoading = false;
      return;
    }
    searchLoading = true;
    invoke<VaultEntry[]>("passwords_search", { query: q })
      .then((results) => {
        searchResults = results;
        searchLoading = false;
      })
      .catch((e) => {
        searchError = sanitizeError(String(e));
        searchResults = [];
        searchLoading = false;
      });
  }

  function onSearchInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 250);
  }

  function openAddForm() {
    editingId = null;
    formData = { site: "", username: "", password: "", notes: "" };
    formDirty = false;
    showFormPassword = false;
    dialogOpen = true;
    tick().then(() => firstInput?.focus());
  }

  function openEditForm(entry: VaultEntry) {
    editingId = entry.id;
    formData = {
      site: entry.site,
      username: entry.username,
      password: entry.password,
      notes: entry.notes,
    };
    formDirty = false;
    showFormPassword = false;
    dialogOpen = true;
    tick().then(() => firstInput?.focus());
  }

  function closeForm() {
    if (formDirty) {
      confirmMessage = _t("modulePasswordsConfirmDiscard", "Discard unsaved changes?");
      confirmAction = () => {
        dialogOpen = false;
        editingId = null;
        formDirty = false;
        showFormPassword = false;
      };
      confirmOpen = true;
      return;
    }
    dialogOpen = false;
    editingId = null;
    formDirty = false;
    showFormPassword = false;
  }

  function markDirty() {
    formDirty = true;
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
      toast.success(_t("modulePasswordsSaved", "Password saved"));
      closeForm();
      await loadEntries();
    } catch (e) {
      toast.error(sanitizeError(String(e)));
    } finally {
      saving = false;
    }
  }

  let deletingId = $state<string | null>(null);

  function confirmDelete(id: string) {
    confirmMessage = _t("modulePasswordsConfirmDelete", "Are you sure you want to delete this entry?");
    deletingId = id;
    confirmAction = async () => {
      const id = deletingId!;
      deletingId = null;
      try {
        await invoke("passwords_delete", { id });
        toast.success(_t("modulePasswordsDeleted", "Password deleted"));
        if (selectedEntry?.id === id) selectedEntry = null;
        entries = entries.filter(e => e.id !== id);
        if (searchResults.length) searchResults = searchResults.filter(e => e.id !== id);
      } catch (e) {
        toast.error(sanitizeError(String(e)));
      }
    };
    confirmOpen = true;
  }

  function togglePassword(id: string) {
    visiblePasswords = { ...visiblePasswords, [id]: !visiblePasswords[id] };
  }

  $effect(() => {
    const current = copiedId;
    if (current) {
      const timer = setTimeout(() => { copiedId = null; }, 1500);
      return () => { clearTimeout(timer); };
    }
  });

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

  const totalEntries = $derived(displayEntries.length);
  const strongEntries = $derived(displayEntries.filter(e => e.password.length >= 15).length);
  const fairEntries = $derived(displayEntries.filter(e => e.password.length >= 12 && e.password.length < 15).length);
  const weakEntries = $derived(displayEntries.filter(e => e.password.length < 12).length);
  const vaultScore = $derived(displayEntries.length > 0 ? Math.round((strongEntries / displayEntries.length) * 100) : 0);
  const ringColor = $derived(vaultScore >= 70 ? 'oklch(0.723 0.192 149.579)' : vaultScore >= 40 ? 'oklch(0.769 0.165 70.080)' : 'oklch(0.637 0.208 25.331)');

  function siteColor(site: string): string {
    const colors = [
      'oklch(0.585 0.204 277.117)', 'oklch(0.627 0.233 303.900)', 'oklch(0.541 0.247 293.009)',
      'oklch(0.708 0.152 269.741)', 'oklch(0.606 0.219 292.717)', 'oklch(0.680 0.158 276.935)',
      'oklch(0.709 0.159 293.541)', 'oklch(0.553 0.195 38.449)', 'oklch(0.646 0.222 41.116)',
      'oklch(0.769 0.165 70.080)', 'oklch(0.715 0.143 215.221)', 'oklch(0.637 0.208 25.331)',
    ];
    let hash = 0;
    for (let i = 0; i < site.length; i++) hash = ((hash << 5) - hash) + site.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  }

  function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  function handleListKeydown(e: KeyboardEvent) {
    const items = displayEntries;
    if (items.length === 0) return;
    const currentIdx = selectedEntry ? items.findIndex(e => e.id === selectedEntry!.id) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIdx < items.length - 1 ? currentIdx + 1 : 0;
      selectedEntry = items[next];
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = currentIdx > 0 ? currentIdx - 1 : items.length - 1;
      selectedEntry = items[prev];
    }
  }
  const arcR = 72;
  const arcStroke = 12;
  const arcCircumference = 2 * Math.PI * arcR;
  const lastUpdatedEntry = $derived(
    displayEntries.length > 0
      ? displayEntries.reduce((max, e) => e.updated > max.updated ? e : max, displayEntries[0])
      : null
  );

  function passwordStrength(pw: string): { label: string; pct: number; level: string } {
    const len = pw.length;
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasDigit = /[0-9]/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const variety = +hasUpper + +hasLower + +hasDigit + +hasSpecial;
    if (len >= 16 && variety >= 3) return { label: _t("modulePasswordsStrengthStrong", "Strong"), pct: 100, level: "strong" };
    if (len >= 12 && variety >= 2) return { label: _t("modulePasswordsStrengthGood", "Good"), pct: 72, level: "good" };
    if (len >= 8 && variety >= 1) return { label: _t("modulePasswordsStrengthFair", "Fair"), pct: 42, level: "fair" };
    return { label: _t("modulePasswordsStrengthWeak", "Weak"), pct: 18, level: "weak" };
  }

  function generatePassword(): string {
    const length = 20;
    const pools = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz", "0123456789", "!@#$%^&*()_-+=<>?"];
    const all = pools.join("");
    const indices = new Uint32Array(length);
    crypto.getRandomValues(indices);
    const chars = new Array<string>(length);
    for (let i = 0; i < pools.length; i++) {
      chars[i] = pools[i][indices[i] % pools[i].length];
    }
    for (let i = pools.length; i < length; i++) {
      chars[i] = all[indices[i] % all.length];
    }
    for (let i = length - 1; i > 0; i--) {
      const j = indices[i] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }

  let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyText(text: string, id: string, messageKey: string, fallback: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = id;
      toast.success(_t(messageKey, fallback));
      if (clipboardClearTimer) clearTimeout(clipboardClearTimer);
      clipboardClearTimer = setTimeout(() => navigator.clipboard.writeText(""), 30000);
    } catch (e) {
      toast.error(sanitizeError(String(e)));
    }
  }
</script>

<main class="pw-workspace module-root" data-module="passwords">
  {#if selectedSection === "Vault"}
    <section class="pw-page">
      <header class="pw-page__header">
        <div class="pw-page__intro">
          <div class="pw-page__eyebrow">
            <ShieldIcon size={13}/>
            <span>{_t("modulePasswordsTitle", "Passwords")}</span>
            <Badge variant="outline">{selectedSection}</Badge>
          </div>
          <h1>{_t("modulePasswordsTitle", "Passwords")}</h1>
          <p>{_t("modulePasswordsDesc", "Secure credential vault.")}</p>
        </div>
        <div class="pw-page__actions">
          <Button onclick={openAddForm}>
            <PlusIcon size={16}/>
            <span>{_t("modulePasswordsAddPassword", "Add Password")}</span>
          </Button>
        </div>
      </header>

      {#if !loading && !searchLoading && displayEntries.length > 0}
        <section class="pw-hero-grid">
          <Card class="pw-health-card">
            <CardHeader>
              <CardTitle>{_t("modulePasswordsVaultHealth", "Vault Health")}</CardTitle>
              <CardDescription>{_t("modulePasswordsVaultHealthDesc", "Overall security posture")}</CardDescription>
            </CardHeader>
            <CardContent class="pw-health-content">
              <div class="pw-orb" role="img" aria-label="Vault health score: {vaultScore} out of 100">
                <svg viewBox="0 0 200 200" class="pw-orb-svg">
                  <circle cx="100" cy="100" r={arcR} fill="none" stroke="color-mix(in srgb, var(--pw-border) 60%, transparent)" stroke-width={arcStroke} />
                  <circle cx="100" cy="100" r={arcR} fill="none" stroke={ringColor} stroke-width={arcStroke} stroke-linecap="round" stroke-dasharray="{(vaultScore / 100) * arcCircumference} {arcCircumference - (vaultScore / 100) * arcCircumference}" transform="rotate(-90 100 100)" />
                </svg>
                <div class="pw-orb-center">
                  <strong class="number number-hero number-semibold" style="color:{ringColor}">{vaultScore}</strong>
                  <small>{_t("modulePasswordsVaultHealth", "Vault health")}</small>
                </div>
              </div>
              <div class="pw-health-meta">
                <div>
                  <strong class="number number-tabular">{totalEntries}</strong>
                  <span>{_t("modulePasswordsTotal", "Total")}</span>
                </div>
                <div>
                  <strong class="number number-tabular">{strongEntries}</strong>
                  <span>{_t("modulePasswordsStrengthStrong", "Strong")}</span>
                </div>
                <div>
                  <strong class="number number-tabular">{weakEntries}</strong>
                  <span>{_t("modulePasswordsStrengthWeak", "Weak")}</span>
                </div>
                {#if lastUpdatedEntry}
                  <div>
                    <strong class="number number-tabular">{new Date(lastUpdatedEntry.updated).toLocaleDateString()}</strong>
                    <span>{_t("modulePasswordsLastUpdated", "Updated")}</span>
                  </div>
                {/if}
              </div>
            </CardContent>
          </Card>

          <Card class="pw-overview-card">
            <CardHeader>
              <CardTitle>{_t("modulePasswordsVaultOverview", "Vault Overview")}</CardTitle>
              <CardDescription>{_t("modulePasswordsVaultOverviewDesc", "Password strength distribution")}</CardDescription>
            </CardHeader>
            <CardContent class="pw-overview-content">
              <div class="pw-dist-row pw-dist-row--strong">
                <div class="pw-dist-head">
                  <strong class="number number-hero">{strongEntries}</strong>
                  <span>{_t("modulePasswordsStrengthStrong", "Strong")}</span>
                </div>
                <div class="pw-dist-bar"><i style="width: {displayEntries.length > 0 ? (strongEntries / displayEntries.length) * 100 : 0}%"></i></div>
              </div>
              <div class="pw-dist-row pw-dist-row--fair">
                <div class="pw-dist-head">
                  <strong class="number number-hero">{fairEntries}</strong>
                  <span>{_t("modulePasswordsStrengthGood", "Fair")}</span>
                </div>
                <div class="pw-dist-bar"><i style="width: {displayEntries.length > 0 ? (fairEntries / displayEntries.length) * 100 : 0}%"></i></div>
              </div>
              <div class="pw-dist-row pw-dist-row--weak">
                <div class="pw-dist-head">
                  <strong class="number number-hero">{weakEntries}</strong>
                  <span>{_t("modulePasswordsStrengthWeak", "Weak")}</span>
                </div>
                <div class="pw-dist-bar"><i style="width: {displayEntries.length > 0 ? (weakEntries / displayEntries.length) * 100 : 0}%"></i></div>
              </div>
            </CardContent>
          </Card>
        </section>
      {/if}

      {#if error}
        <div class="pw-banner pw-banner--error" role="alert">
          <AlertCircleIcon size={16} />
          <span>{_t("modulePasswordsErrorLoad", "Failed to load vault")}: {error}</span>
          <div class="pw-banner-actions">
            <Button variant="outline" size="sm" onclick={loadEntries}>{_t("modulePasswordsRetry", "Retry")}</Button>
            <button class="pw-banner-close" onclick={() => error = null} aria-label={_t("modulePasswordsDismiss", "Dismiss")}><XIcon size={14}/></button>
          </div>
        </div>
      {/if}
      {#if searchError}
        <div class="pw-banner pw-banner--error" role="alert">
          <AlertCircleIcon size={16} />
          <span>{_t("modulePasswordsNoResults", "Search failed")}: {searchError}</span>
          <button class="pw-banner-close" onclick={() => searchError = null} aria-label={_t("modulePasswordsDismiss", "Dismiss")}><XIcon size={14}/></button>
        </div>
      {/if}

      <div class="pw-search-wrap">
        <SearchIcon class="pw-search-icon" size={16}/>
        <input
          class="pw-search-input"
          type="text"
          placeholder={_t("modulePasswordsSearchPlaceholder", "Search sites or usernames…")}
          bind:value={searchQuery}
          oninput={onSearchInput}
          autocomplete="off"
        />
        {#if searchQuery}
          <button class="pw-search-clear" onclick={() => { if (debounceTimer) clearTimeout(debounceTimer); searchQuery = ""; searchResults = []; searchError = null; }} aria-label={_t("modulePasswordsCancel", "Clear")}>
            <XIcon size={14}/>
          </button>
        {/if}
      </div>

      <Card class="pw-vault-card">
        <CardContent class="pw-vault-content">
        {#if loading}
          <div class="pw-state pw-state--loading">
            <div class="pw-spinner"></div>
            <p>{_t("modulePasswordsTitle", "Loading vault…")}</p>
          </div>
        {:else if displayEntries.length === 0 && !searchLoading}
          <div class="pw-state pw-state--empty">
            <LockIcon size={32} stroke-width={1.5}/>
            {#if searchQuery}
              <p>{_t("modulePasswordsNoResults", "No matching passwords")}</p>
            {:else}
              <p>{_t("modulePasswordsNoVault", "Your vault is empty")}</p>
              <span class="pw-state-desc">{_t("modulePasswordsNoVaultDesc", "Add your first password to get started.")}</span>
              <Button onclick={openAddForm}>{_t("modulePasswordsAddFirst", "Add Your First Password")}</Button>
            {/if}
          </div>
        {:else if searchLoading}
          <div class="pw-state pw-state--loading">
            <div class="pw-spinner"></div>
            <p>{_t("modulePasswordsTitle", "Searching…")}</p>
          </div>
        {:else}
          <div class="pw-list" bind:this={listEl} tabindex="-1" onkeydown={handleListKeydown}>
            {#each sortedGroups as [letter, items]}
              <div class="pw-group">
                <span class="pw-group-letter">{letter}</span>
                {#each items as entry (entry.id)}
                  <div
                    class="pw-item"
                    class:pw-item--selected={selectedEntry?.id === entry.id}
                    role="button"
                    tabindex="0"
                    onclick={() => { selectedEntry = selectedEntry?.id === entry.id ? null : entry; listEl?.focus(); }}
                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedEntry = selectedEntry?.id === entry.id ? null : entry; listEl?.focus(); } }}
                  >
                    <span class="pw-item-avatar" style="background:{siteColor(entry.site)}22;color:{siteColor(entry.site)}">{entry.site.charAt(0).toUpperCase()}</span>
                    <span class="pw-item-info">
                      <span class="pw-item-site">{entry.site}</span>
                      <span class="pw-item-user">
                        <span>{entry.username}</span>
                        <span class="pw-item-time">{formatRelativeTime(entry.updated)}</span>
                      </span>
                    </span>
                    <span class="pw-item-actions" onclick={(e) => e.stopPropagation()}>
                          <button
                            class="pw-icon-btn"
                            class:pw-icon-btn--copied={copiedId === `user-${entry.id}`}
                            onclick={() => copyText(entry.username, `user-${entry.id}`, "modulePasswordsCopiedUsername", "Username copied")}
                            aria-label={_t("modulePasswordsCopyUsername", "Copy username")}
                            use:tooltip={{ text: _t("modulePasswordsCopyUsername", "Copy username") }}
                          >
                        <CopyIcon size={14}/>
                      </button>
                      <button
                        class="pw-icon-btn"
                        onclick={() => openEditForm(entry)}
                        aria-label={_t("modulePasswordsEditPassword", "Edit")}
                        use:tooltip={{ text: _t("modulePasswordsEditPassword", "Edit") }}
                      >
                        <Edit2Icon size={14}/>
                      </button>
                    </span>
                  </div>

                  {#if selectedEntry?.id === entry.id}
                    <div class="pw-detail">
                      <div class="pw-detail-field">
                        <span class="pw-detail-label">{_t("modulePasswordsUsernameLabel", "Username")}</span>
                        <div class="pw-detail-row">
                          <span class="pw-detail-value number number-tabular">{entry.username}</span>
                          <button
                            class="pw-icon-btn"
                            class:pw-icon-btn--copied={copiedId === `user-${entry.id}`}
                            onclick={() => copyText(entry.username, `user-${entry.id}`, "modulePasswordsCopiedUsername", "Username copied")}
                            aria-label={_t("modulePasswordsCopyUsername", "Copy username")}
                            use:tooltip={{ text: _t("modulePasswordsCopyUsername", "Copy username") }}
                          >
                            <CopyIcon size={14}/>
                          </button>
                        </div>
                      </div>

                      <div class="pw-detail-field">
                        <span class="pw-detail-label">{_t("modulePasswordsPasswordLabel", "Password")}</span>
                        <div class="pw-detail-row">
                          <span class="pw-detail-value pw-detail-value--mono number number-tabular">
                            {visiblePasswords[entry.id] ? entry.password : "•".repeat(Math.min(entry.password.length, 24))}
                          </span>
                          <span class="pw-detail-actions">
                            <button
                              class="pw-icon-btn"
                              onclick={() => togglePassword(entry.id)}
                              aria-label={visiblePasswords[entry.id] ? _t("modulePasswordsCancel", "Hide") : _t("modulePasswordsCancel", "Show")}
                              use:tooltip={{ text: visiblePasswords[entry.id] ? "Hide password" : "Show password" }}
                            >
                              {#if visiblePasswords[entry.id]}
                                <EyeOffIcon size={14}/>
                              {:else}
                                <EyeIcon size={14}/>
                              {/if}
                            </button>
                            <button
                              class="pw-icon-btn"
                              class:pw-icon-btn--copied={copiedId === `pass-${entry.id}`}
                              onclick={() => copyText(entry.password, `pass-${entry.id}`, "modulePasswordsCopiedPassword", "Password copied")}
                              aria-label={_t("modulePasswordsCopyPassword", "Copy password")}
                              use:tooltip={{ text: _t("modulePasswordsCopyPassword", "Copy password") }}
                            >
                              <CopyIcon size={14}/>
                            </button>
                          </span>
                        </div>
                      </div>

                      <div class="pw-detail-field">
                          <span class="pw-detail-label">{_t("modulePasswordsStrengthGood", "Strength")}</span>
                        {#if entry.password}
                          {@const strength = passwordStrength(entry.password)}
                          <div class="pw-meter pw-meter--{strength.level}" style="--fill: {strength.pct}%" role="meter" aria-valuenow={strength.pct} aria-valuemin={0} aria-valuemax={100}>
                            <i></i>
                          </div>
                          <span class="pw-strength-label">{strength.label} <strong class="number number-stat">{strength.pct}%</strong></span>
                        {/if}
                      </div>

                      {#if entry.notes}
                        <div class="pw-detail-field">
                          <span class="pw-detail-label">{_t("modulePasswordsNotesLabel", "Notes")}</span>
                          <p class="pw-detail-notes">{entry.notes}</p>
                        </div>
                      {/if}

                      <div class="pw-detail-footer">
                        <Button variant="destructive" size="sm" onclick={() => confirmDelete(entry.id)}>
                          <Trash2Icon size={14}/>
                          {_t("modulePasswordsDeletePassword", "Delete")}
                        </Button>
                        <Button variant="outline" size="sm" onclick={() => openEditForm(entry)}>
                          <Edit2Icon size={14}/>
                          {_t("modulePasswordsEditPassword", "Edit")}
                        </Button>
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        {/if}
        </CardContent>
      </Card>
    </section>
  {:else if selectedSection === "Health"}
    <section class="pw-page pw-page--center">
      <HeartIcon size={32} stroke-width={1.5} class="pw-stub-icon"/>
      <h2 class="pw-stub-title">Health</h2>
      <p class="pw-stub-desc">{_t("modulePasswordsDesc", "Password health monitoring coming soon.")}</p>
    </section>
  {:else if selectedSection === "Passkeys"}
    <section class="pw-page pw-page--center">
      <KeyRoundIcon size={32} stroke-width={1.5} class="pw-stub-icon"/>
      <h2 class="pw-stub-title">Passkeys</h2>
      <p class="pw-stub-desc">{_t("modulePasswordsDesc", "Passkey management coming soon.")}</p>
    </section>
  {:else if selectedSection === "Secure Notes"}
    <section class="pw-page pw-page--center">
      <FileTextIcon size={32} stroke-width={1.5} class="pw-stub-icon"/>
      <h2 class="pw-stub-title">Secure Notes</h2>
      <p class="pw-stub-desc">{_t("modulePasswordsDesc", "Encrypted notes coming soon.")}</p>
    </section>
  {:else if selectedSection === "Travel Mode"}
    <section class="pw-page pw-page--center">
      <PlaneIcon size={32} stroke-width={1.5} class="pw-stub-icon"/>
      <h2 class="pw-stub-title">Travel Mode</h2>
      <p class="pw-stub-desc">{_t("modulePasswordsDesc", "Travel mode coming soon.")}</p>
    </section>
  {:else if selectedSection === "Audit"}
    <section class="pw-page pw-page--center">
      <ListChecksIcon size={32} stroke-width={1.5} class="pw-stub-icon"/>
      <h2 class="pw-stub-title">Audit</h2>
      <p class="pw-stub-desc">{_t("modulePasswordsDesc", "Security audit coming soon.")}</p>
    </section>
  {/if}
</main>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content showCloseButton={false}>
    <Dialog.Header>
      <Dialog.Title>{editingId ? _t("modulePasswordsEditPassword", "Edit entry") : _t("modulePasswordsAddPassword", "New entry")}</Dialog.Title>
    </Dialog.Header>
    <div class="pw-form" onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEntry(); } }}>
      <div class="pw-field">
        <span class="pw-field-label">{_t("modulePasswordsSiteLabel", "Site")}</span>
        <Input
          type="text"
          placeholder={_t("modulePasswordsSitePlaceholder", "e.g. GitHub")}
          bind:value={formData.site}
          oninput={markDirty}
          ref={firstInput}
        />
      </div>
      <div class="pw-field">
        <span class="pw-field-label">{_t("modulePasswordsUsernameLabel", "Username")}</span>
        <Input
          type="text"
          placeholder={_t("modulePasswordsUserPlaceholder", "e.g. user@email.com")}
          bind:value={formData.username}
          oninput={markDirty}
        />
      </div>
      <div class="pw-field">
        <span class="pw-field-label">{_t("modulePasswordsPasswordLabel", "Password")}</span>
        <div class="pw-password-wrap">
          <Input
            type={showFormPassword ? "text" : "password"}
            placeholder={_t("modulePasswordsPassPlaceholder", "Enter password")}
            bind:value={formData.password}
            oninput={markDirty}
            class="pw-password-input"
          />
          <button
            class="pw-icon-btn pw-password-toggle"
            onclick={() => showFormPassword = !showFormPassword}
            aria-label={showFormPassword ? "Hide" : "Show"}
            type="button"
            tabindex="-1"
          >
            {#if showFormPassword}
              <EyeOffIcon size={14}/>
            {:else}
              <EyeIcon size={14}/>
            {/if}
          </button>
          <button
            class="pw-icon-btn pw-password-gen"
            onclick={() => { formData.password = generatePassword(); markDirty(); }}
            aria-label={_t("modulePasswordsGenerate", "Generate")}
            type="button"
            use:tooltip={{ text: _t("modulePasswordsGenerate", "Generate") }}
          >
            <WandSparklesIcon size={14}/>
          </button>
        </div>
      </div>
      <div class="pw-field">
        <span class="pw-field-label">{_t("modulePasswordsNotesLabel", "Notes")}</span>
        <textarea
          class="pw-textarea"
          placeholder={_t("modulePasswordsNotesPlaceholder", "Optional notes…")}
          bind:value={formData.notes}
          oninput={markDirty}
          rows={3}
        ></textarea>
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={closeForm}>{_t("modulePasswordsCancel", "Cancel")}</Button>
      <Button
        onclick={saveEntry}
        disabled={!formData.site.trim() || !formData.username.trim() || !formData.password.trim() || saving}
      >
        {saving ? _t("modulePasswordsSave", "Saving…") : editingId ? _t("modulePasswordsUpdate", "Save changes") : _t("modulePasswordsSave", "Save")}
        {#if !saving}<CheckIcon size={16}/>{/if}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={confirmOpen}>
  <Dialog.Content showCloseButton={false} class="pw-confirm-dialog">
    <Dialog.Header>
      <Dialog.Title>{_t("modulePasswordsConfirmTitle", "Confirm")}</Dialog.Title>
    </Dialog.Header>
    <p class="pw-confirm-message">{confirmMessage}</p>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => { confirmOpen = false; confirmAction = null; }}>{_t("modulePasswordsCancel", "Cancel")}</Button>
      <Button variant="destructive" onclick={async () => { const action = confirmAction; confirmOpen = false; confirmAction = null; await action?.(); }}>{_t("modulePasswordsConfirm", "Confirm")}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.pw-workspace) {
    --pw-bg:             var(--background);
    --pw-surface:        color-mix(in srgb, var(--surface) 96%, var(--background));
    --pw-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --pw-border:         color-mix(in srgb, var(--border) 86%, transparent);
    --pw-ink:            var(--foreground);
    --pw-muted:          var(--muted);
    --pw-accent:         oklch(0.585 0.204 277.117);
    --pw-accent-soft:    color-mix(in srgb, oklch(0.585 0.204 277.117) 36%, var(--primary));
    --pw-accent-bg:      color-mix(in srgb, oklch(0.585 0.204 277.117) 12%, var(--background));
    --ease-spring:       cubic-bezier(0.34, 1.56, 0.64, 1);
    --ease-out:          cubic-bezier(0.23, 1, 0.32, 1);
    height:          100%;
    background:     var(--pw-bg);
    color:           var(--pw-ink);
    overflow:        hidden;
    font-family:     var(--font-body);
    font-synthesis:  none;
    -webkit-font-smoothing:  antialiased;
    -moz-osx-font-smoothing: grayscale;
    box-sizing:      border-box;
  }
  :global(.pw-workspace) ::selection {
    background: color-mix(in srgb, var(--pw-accent) 22%, transparent);
    color: var(--pw-ink);
  }

  :global(.pw-page) {
    display:             flex;
    flex-direction:      column;
    gap:                 18px;
    height:              100%;
    min-height:          0;
    padding:             28px 30px;
    box-sizing:          border-box;
    overflow:            hidden;
  }
  :global(.pw-page--center) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 80px 20px;
    text-align: center;
  }

  :global(.pw-page__header) {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
  }
  :global(.pw-page__intro) { max-width: 56rem; }
  :global(.pw-page__eyebrow) {
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
    color: var(--pw-muted); font-size: 0.82rem; letter-spacing: 0.18em; text-transform: uppercase;
  }
  :global(.pw-page__intro) h1 {
    margin: 0; font-size: clamp(1.7rem,2.5vw,2.6rem); line-height: 1.05;
    font-family: var(--font-display); letter-spacing: -0.02em; text-wrap: balance;
  }
  :global(.pw-page__intro) p {
    margin: 12px 0 0; max-width: 42rem; color: var(--pw-muted);
    font-size: 0.97rem; line-height: 1.55; text-wrap: pretty;
  }
  :global(.pw-page__actions) { display: flex; gap: 12px; flex-shrink: 0; }

  :global(.pw-hero-grid) {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 16px;
    flex-shrink: 0;
  }
  :global(.pw-health-card),
  :global(.pw-overview-card),
  :global(.pw-vault-card) {
    border: none;
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--pw-surface) 98%, var(--background)),
      color-mix(in srgb, var(--pw-surface) 86%, var(--background))
    );
  }
  :global(.pw-vault-card) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  :global(.pw-vault-card) :global(.card-content) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  :global(.pw-vault-content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--shell-scrollbar-thumb) var(--shell-scrollbar-track);
  }
  :global(.pw-health-content) {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 20px;
    align-items: center;
  }
  :global(.pw-orb) {
    position: relative;
    width: 160px;
    height: 160px;
    flex-shrink: 0;
  }
  :global(.pw-orb-svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  :global(.pw-orb-center) {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  :global(.pw-orb-center) strong {
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--pw-accent);
  }
  :global(.pw-orb-center) small {
    color: var(--pw-muted);
    font-size: 0.8rem;
  }
  :global(.pw-health-meta) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  :global(.pw-health-meta) div {
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--pw-border) 90%, transparent);
    background: color-mix(in srgb, var(--pw-surface-strong) 90%, transparent);
  }
  :global(.pw-health-meta) strong {
    display: block;
    font-size: 1.1rem;
  }
  :global(.pw-health-meta) span {
    display: block;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--pw-muted);
    margin-top: 2px;
  }
  :global(.pw-overview-content) {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  :global(.pw-dist-row) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--pw-border) 90%, transparent);
    background: color-mix(in srgb, var(--pw-surface-strong) 90%, transparent);
  }
  :global(.pw-dist-head) {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  :global(.pw-dist-head) strong {
    line-height: 1;
  }
  :global(.pw-dist-head) span {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--pw-muted);
  }
  :global(.pw-dist-bar) {
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--pw-border) 72%, transparent);
    overflow: hidden;
  }
  :global(.pw-dist-bar) i {
    display: block;
    height: 100%;
    border-radius: inherit;
    transition: width 0.4s ease;
  }
  :global(.pw-dist-row--strong) i { background: oklch(0.723 0.192 149.579); }
  :global(.pw-dist-row--fair) i   { background: oklch(0.769 0.165 70.080); }
  :global(.pw-dist-row--weak) i   { background: oklch(0.637 0.208 25.331); }

  :global(.pw-search-wrap) {
    position: relative;
    display: flex;
    align-items: center;
  }
  :global(.pw-search-icon) {
    position: absolute;
    left: 12px;
    color: var(--pw-muted);
    pointer-events: none;
  }
  :global(.pw-search-input) {
    width: 100%;
    padding: 10px 36px 10px 36px;
    border: 1px solid var(--pw-border);
    border-radius: 12px;
    background: var(--pw-bg);
    color: var(--pw-ink);
    font-size: 0.88rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s var(--ease-out);
  }
  :global(.pw-search-input:focus) {
    border-color: var(--pw-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--pw-accent) 20%, transparent);
  }
  :global(.pw-search-input::placeholder) {
    color: var(--pw-muted);
  }
  :global(.pw-search-clear) {
    position: absolute;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--pw-muted);
    cursor: pointer;
  }
  :global(.pw-search-clear:hover) {
    background: color-mix(in srgb, var(--pw-ink) 8%, transparent);
    color: var(--pw-ink);
  }
  :global(.pw-search-clear:focus-visible) {
    outline: 2px solid var(--pw-accent);
    outline-offset: 1px;
  }

  :global(.pw-state) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 60px 20px;
    text-align: center;
    color: var(--pw-muted);
  }
  :global(.pw-state--loading) {
    padding: 80px 20px;
  }
  :global(.pw-state--empty) {
    padding: 60px 20px;
  }
  :global(.pw-state svg) {
    opacity: 0.4;
  }
  :global(.pw-state-desc) {
    font-size: 0.85rem;
    color: var(--pw-muted);
    max-width: 260px;
  }
  :global(.pw-spinner) {
    width: 28px;
    height: 28px;
    border: 3px solid color-mix(in srgb, var(--pw-accent) 30%, transparent);
    border-top-color: var(--pw-accent);
    border-radius: 50%;
    animation: pw-spin 0.8s linear infinite;
  }
  @keyframes pw-spin {
    to { transform: rotate(360deg); }
  }

  :global(.pw-banner) {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 500;
    flex-shrink: 0;
  }
  :global(.pw-banner--error) {
    background: color-mix(in srgb, oklch(0.637 0.208 25.331) 12%, transparent);
    border: 1px solid color-mix(in srgb, oklch(0.637 0.208 25.331) 28%, transparent);
    color: oklch(0.637 0.208 25.331);
  }
  :global(.pw-banner) span {
    flex: 1;
  }
  :global(.pw-banner-actions) {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  :global(.pw-banner-close) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    flex-shrink: 0;
    opacity: 0.7;
  }
  :global(.pw-banner-close:hover) { opacity: 1; }

  :global(.pw-list) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 8px;
    outline: none;
  }
  :global(.pw-list:focus-visible) {
    outline: 1.5px solid color-mix(in srgb, var(--pw-accent) 30%, transparent);
    outline-offset: 2px;
    border-radius: 8px;
  }
  :global(.pw-group) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  :global(.pw-group-letter) {
    font-family: var(--font-heading);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--pw-muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 4px 2px;
  }
  :global(.pw-item) {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    border: 1px solid color-mix(in srgb, var(--pw-border) 92%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--pw-surface-strong) 92%, transparent);
    color: var(--pw-ink);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    transition: border-color 0.15s var(--ease-out), background 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
    box-sizing: border-box;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.pw-item:hover) {
      border-color: color-mix(in srgb, var(--pw-border) 60%, transparent);
      background: color-mix(in srgb, var(--pw-surface) 96%, var(--background));
    }
  }
  :global(.pw-item:active) {
    transform: scale(0.995);
  }
  :global(.pw-item:focus-visible) {
    outline: 2px solid var(--pw-accent);
    outline-offset: 1px;
  }
  :global(.pw-item--selected) {
    border-color: color-mix(in srgb, var(--pw-accent) 40%, transparent);
    background: color-mix(in srgb, var(--pw-accent) 8%, transparent);
  }
  :global(.pw-item-avatar) {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: color-mix(in srgb, var(--pw-ink) 8%, transparent);
    color: var(--pw-ink);
    font-weight: 700;
    font-size: 15px;
    flex-shrink: 0;
    transition: background 0.15s var(--ease-out), color 0.15s var(--ease-out);
  }
  :global(.pw-item--selected) .pw-item-avatar {
    box-shadow: 0 0 0 1.5px var(--pw-accent);
  }
  :global(.pw-item-info) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  :global(.pw-item-site) {
    font-weight: 600;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.pw-item-user) {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.78rem;
    color: var(--pw-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.pw-item-time) {
    flex-shrink: 0;
    font-size: 0.65rem;
    opacity: 0.5;
    letter-spacing: 0.02em;
  }
  :global(.pw-item--selected) .pw-item-time {
    opacity: 0.7;
  }
  :global(.pw-item-actions) {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  :global(.pw-icon-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--pw-muted);
    cursor: pointer;
    transition: background 0.15s var(--ease-out), color 0.15s var(--ease-out);
    position: relative;
  }
  @media (hover: hover) and (pointer: fine) {
    :global(.pw-icon-btn:hover) { background: color-mix(in srgb, var(--pw-ink) 8%, transparent); color: var(--pw-ink); }
  }
  :global(.pw-icon-btn:focus-visible) {
    outline: 2px solid var(--pw-accent);
    outline-offset: 1px;
  }
  :global(.pw-icon-btn:active) {
    transform: scale(0.92);
  }
  :global(.pw-icon-btn--copied) {
    color: oklch(0.723 0.192 149.579) !important;
  }
  :global(.pw-icon-btn--copied::after) {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 10px;
    border: 1.5px solid oklch(0.723 0.192 149.579);
    animation: pw-copied-pulse 0.6s ease-out;
  }
  @keyframes pw-copied-pulse {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.15); opacity: 0; }
  }

  :global(.pw-detail) {
    display: grid;
    gap: 16px;
    padding: 20px;
    margin: 0 0 4px;
    border-radius: 20px;
    border: 1px solid var(--pw-border);
    background: linear-gradient(180deg,
      color-mix(in srgb, var(--pw-surface) 98%, var(--pw-bg)),
      color-mix(in srgb, var(--pw-surface) 86%, var(--pw-bg)));
  }
  :global(.pw-detail-field) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  :global(.pw-detail-label) {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--pw-muted);
  }
  :global(.pw-detail-row) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--pw-surface-strong) 88%, transparent);
    border: 1px solid color-mix(in srgb, var(--pw-border) 92%, transparent);
  }
  :global(.pw-detail-value) {
    font-size: 0.85rem;
    color: var(--pw-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  :global(.pw-detail-value--mono) {
    font-family: var(--font-mono, monospace);
    letter-spacing: 0.1em;
  }
  :global(.pw-detail-actions) {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  :global(.pw-meter) {
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--pw-border) 72%, transparent);
    overflow: hidden;
  }
  :global(.pw-meter) i {
    display: block;
    width: var(--fill);
    height: 100%;
    border-radius: inherit;
    transition: width 0.4s ease, background 0.4s ease;
  }
  :global(.pw-meter--strong) i { background: linear-gradient(90deg, oklch(0.723 0.192 149.579), oklch(0.627 0.186 160.940)); }
  :global(.pw-meter--good) i   { background: linear-gradient(90deg, oklch(0.769 0.165 70.080), oklch(0.686 0.141 58.585)); }
  :global(.pw-meter--fair) i   { background: linear-gradient(90deg, oklch(0.715 0.143 215.221), oklch(0.632 0.126 227.717)); }
  :global(.pw-meter--weak) i   { background: linear-gradient(90deg, oklch(0.637 0.208 25.331), oklch(0.553 0.180 25.331)); }
  :global(.pw-strength-label) {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--pw-muted);
  }

  :global(.pw-detail-notes) {
    font-size: 0.85rem;
    color: var(--pw-muted);
    margin: 0;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  :global(.pw-detail-footer) {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid color-mix(in srgb, var(--pw-border) 92%, transparent);
  }

  :global(.pw-stub-icon) {
    opacity: 0.3;
    color: var(--pw-muted);
  }
  :global(.pw-stub-title) {
    font-family: var(--font-heading);
    font-size: 1.3rem;
    font-weight: 700;
    margin: 0;
  }
  :global(.pw-stub-desc) {
    font-size: 0.9rem;
    color: var(--pw-muted);
    margin: 0;
    max-width: 28rem;
  }

  :global(.pw-form) {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  :global(.pw-field) {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  :global(.pw-field-label) {
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--pw-muted);
  }
  :global(.pw-password-wrap) {
    position: relative;
    display: flex;
    align-items: center;
  }
  :global(.pw-password-input) {
    width: 100%;
  }
  :global(.pw-password-toggle) {
    position: absolute;
    right: 32px;
    top: 50%;
    transform: translateY(-50%);
  }
  :global(.pw-password-gen) {
    position: absolute;
    right: 2px;
    top: 50%;
    transform: translateY(-50%);
  }
  :global(.pw-textarea) {
    padding: 10px 12px;
    border: 1px solid var(--pw-border);
    border-radius: 10px;
    background: var(--pw-bg);
    color: var(--pw-ink);
    font-size: 0.88rem;
    font-family: inherit;
    outline: none;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.15s var(--ease-out);
  }
  :global(.pw-textarea:focus) {
    border-color: var(--pw-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--pw-accent) 20%, transparent);
  }
  :global(.pw-textarea::placeholder) {
    color: var(--pw-muted);
  }

  @media (max-width: 860px) {
    :global(.pw-page) { padding: 20px 18px; }
    :global(.pw-hero-grid) { grid-template-columns: 1fr; }
    :global(.pw-health-content) { grid-template-columns: 1fr; justify-items: center; }
    :global(.pw-orb) { width: 140px; height: 140px; }
    :global(.pw-orb-center) strong { font-size: 2.4rem; }
    :global(.pw-health-meta) { width: 100%; }
  }
  @media (max-width: 600px) {
    :global(.pw-page) { padding: 14px 12px; gap: 14px; }
    :global(.pw-page__header) { flex-direction: column; gap: 12px; }
    :global(.pw-page__actions) { width: 100%; }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.pw-workspace),
    :global(.pw-item),
    :global(.pw-icon-btn),
    :global(.pw-search-input),
    :global(.pw-textarea) {
      transition: none !important;
      animation: none !important;
    }
    :global(.pw-item:active),
    :global(.pw-icon-btn:active) {
      transform: none !important;
    }
  }
  :global(.pw-confirm-message) {
    margin: 0;
    padding: 0 24px;
    font-size: 0.9rem;
    color: var(--pw-muted);
    line-height: 1.5;
  }

</style>

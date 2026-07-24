<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";

  // ── Types ──────────────────────────────────────────────────
  interface AccountInfo {
    name: string;
    email: string;
    avatarUrl: string | null;
    plan: string;
    renewalDate: string | null;
    devices: Array<{ id: string; name: string; os: string; lastSynced: string | null; isCurrent: boolean }>;
  }

  // ── State (Anytype: reactive state derived from profile) ───
  let accountInfo: AccountInfo | null = $state(null);
  let loading = $state(true);
  let saving = $state(false);

  // Edit state (Anytype: controlled input with value tracking)
  let editing = $state(false);
  let editName = $state("");
  let editError = $state<string | null>(null);
  let editSuccess = $state<string | null>(null);
  let successTimer: ReturnType<typeof setTimeout> | undefined = $state(undefined);

  // ── Load account info on mount ─────────────────────────────
  onMount(async () => {
    try {
      accountInfo = await invoke<AccountInfo>("get_account_info");
    } catch (err) {
      console.error("Failed to load account info:", err);
    } finally {
      loading = false;
    }
  });

  // ── Handlers (Anytype: onSave pattern with debounce) ───────
  function startEditing() {
    editName = accountInfo?.name ?? "";
    editError = null;
    editSuccess = null;
    editing = true;
  }

  function cancelEditing() {
    editing = false;
    editError = null;
    editSuccess = null;
  }

  async function saveDisplayName() {
    const trimmed = editName.trim();
    if (!trimmed) {
      editError = "Display name cannot be empty.";
      return;
    }
    if (trimmed.length > 100) {
      editError = "Display name must be 100 characters or fewer.";
      return;
    }

    saving = true;
    editError = null;
    editSuccess = null;

    try {
      await invoke("update_display_name", { name: trimmed });
      // Update local state (Anytype: profile[key] = value after save)
      if (accountInfo) {
        accountInfo = { ...accountInfo, name: trimmed };
      }
      editing = false;
      editSuccess = "Display name saved.";
      // Auto-clear success after 3s (Anytype: debounced auto-clear pattern)
      clearTimeout(successTimer);
      successTimer = setTimeout(() => { editSuccess = null; }, 3000);
    } catch (err) {
      editError = typeof err === "string" ? err : "Failed to save display name.";
    } finally {
      saving = false;
    }
  }

  // Clean up timer on unmount (Anytype: useEffect cleanup pattern)
  onDestroy(() => {
    if (successTimer) clearTimeout(successTimer);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !saving) {
      e.preventDefault();
      saveDisplayName();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  }
</script>

<section class="account-page grid gap-6 xl:grid-cols-3">
  {#if editSuccess}
    <div class="account-page__toast account-page__toast--success" role="status">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
        <path d="M5 8.5L7 10.5L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      {editSuccess}
    </div>
  {/if}

  <!-- Anytype: .section.top with avatar/icon (first card) -->
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none xl:col-span-1">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Profile
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3 text-sm text-[var(--muted)]">
      {#if loading}
        <p class="flex items-center gap-2">
          <span class="account-page__spinner"></span>
          Loading profile...
        </p>
      {:else if accountInfo}
        <!-- Anytype: avatar icon area (simplified) -->
        <div class="account-page__avatar">
          {#if accountInfo.avatarUrl}
            <img src={accountInfo.avatarUrl} alt="Avatar" class="account-page__avatar-img" />
          {:else}
            <div class="account-page__avatar-placeholder">
              {accountInfo.name.charAt(0).toUpperCase()}
            </div>
          {/if}
        </div>

        <!-- Anytype: Personal Information section -->
        <div class="account-page__section">
          <label class="account-page__label" for="display-name-input">Display Name</label>
          {#if editing}
            <div class="account-page__edit-row">
              <input
                id="display-name-input"
                type="text"
                bind:value={editName}
                class="account-page__input"
                maxlength="100"
                placeholder="Your display name"
                onkeydown={handleKeydown}
                disabled={saving}
              />
              <div class="account-page__edit-actions">
                <button
                  class="account-page__btn account-page__btn--primary"
                  onclick={saveDisplayName}
                  disabled={saving}
                  aria-label="Save display name"
                >
                  {#if saving}
                    <span class="account-page__spinner"></span>
                    Saving...
                  {:else}
                    Save
                  {/if}
                </button>
                <button
                  class="account-page__btn account-page__btn--ghost"
                  onclick={cancelEditing}
                  disabled={saving}
                  aria-label="Cancel editing"
                >
                  Cancel
                </button>
              </div>
            </div>
            {#if editError}
              <p class="account-page__error" role="alert">{editError}</p>
            {/if}
          {:else}
            <div class="account-page__value-row">
              <span class="account-page__value">{accountInfo.name}</span>
              <button
                class="account-page__btn account-page__btn--icon"
                onclick={startEditing}
                aria-label="Edit display name"
                title="Edit display name"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M10.5 1.5L12.5 3.5L4.5 11.5L1 13L2.5 9.5L10.5 1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          {/if}
        </div>

        <!-- Email (readonly, Anytype pattern: readonly Input with copy) -->
        <div class="account-page__section">
          <span class="account-page__label">Email</span>
          <div class="account-page__value-row">
            <span class="account-page__value">{accountInfo.email}</span>
          </div>
        </div>

        <!-- Plan info -->
        <div class="account-page__section">
          <span class="account-page__label">Plan</span>
          <div class="account-page__value-row">
            <span class="account-page__value">{accountInfo.plan}</span>
          </div>
        </div>

        {#if accountInfo.renewalDate}
          <div class="account-page__section">
            <span class="account-page__label">Renewal Date</span>
            <div class="account-page__value-row">
              <span class="account-page__value">{accountInfo.renewalDate}</span>
            </div>
          </div>
        {/if}
      {/if}
    </CardContent>
  </Card>

  <!-- Anytype: .section for identity (second card) -->
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none xl:col-span-2">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Security and identity
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3">
      {#each ["Signed-in devices", "Local cache encryption", "Project sync health"] as line}
        <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
          <p class="font-semibold text-[var(--foreground)]">{line}</p>
          <p class="mt-1 text-sm text-[var(--muted)]">
            Desktop-specific account surfaces remain isolated from the web runtime.
          </p>
        </div>
      {/each}
    </CardContent>
  </Card>
</section>

<style>
  /* ── Anytype: sections + input styling ────────────── */
  .account-page__section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .account-page__label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .account-page__value-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .account-page__value {
    font-size: 0.9375rem;
    color: var(--foreground);
    padding: 0.375rem 0;
  }

  /* ── Edit row (Anytype: inputWrapper) ─────────────── */
  .account-page__edit-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .account-page__input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.9375rem;
    color: var(--foreground);
    background: color-mix(in srgb, var(--background) 92%, var(--foreground));
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    border-radius: 12px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    box-sizing: border-box;
  }

  .account-page__input:focus {
    border-color: var(--accent, oklch(0.636 0.196 274.568));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, oklch(0.636 0.196 274.568)) 20%, transparent);
  }

  .account-page__input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Edit actions row ─────────────────────────────── */
  .account-page__edit-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* ── Buttons ──────────────────────────────────────── */
  .account-page__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
  }

  .account-page__btn--primary {
    color: oklch(1 0 89.876);
    background: var(--accent, oklch(0.636 0.196 274.568));
  }

  .account-page__btn--primary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent, oklch(0.636 0.196 274.568)) 80%, oklch(0 0 0));
  }

  .account-page__btn--ghost {
    color: var(--foreground);
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  }

  .account-page__btn--ghost:hover:not(:disabled) {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  .account-page__btn--icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--muted);
    border-radius: 8px;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .account-page__btn--icon:hover {
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }

  .account-page__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Avatar ───────────────────────────────────────── */
  .account-page__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .account-page__avatar-img {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .account-page__avatar-placeholder {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent, oklch(0.636 0.196 274.568)) 20%, transparent);
    color: var(--accent, oklch(0.636 0.196 274.568));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 600;
    font-family: var(--font-heading);
  }

  /* ── Error ────────────────────────────────────────── */
  .account-page__error {
    font-size: 0.8125rem;
    color: oklch(0.631 0.194 29.442);
    margin: 0;
    animation: account-error-in 0.2s ease-out;
  }

  @keyframes account-error-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ── Toast (Anytype: notification pattern) ────────── */
  .account-page__toast {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.125rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 14px;
    z-index: 1000;
    animation: account-toast-in 0.25s ease-out;
    box-shadow: var(--shadow-sm);
  }

  .account-page__toast--success {
    color: oklch(0.523 0.135 144.167);
    background: oklch(0.957 0.021 147.636);
    border: 1px solid oklch(0.895 0.05 146.037);
  }

  @keyframes account-toast-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  /* ── Spinner ──────────────────────────────────────── */
  .account-page__spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: account-spin 0.6s linear infinite;
  }

  @keyframes account-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

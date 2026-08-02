<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "@mateothegreat/svelte5-router";
  import { isTauri } from "@tauri-apps/api/core";
  import NotesApp from "../../modules/notes/App.svelte";
  import { canAccessModuleByPlan } from "$lib/desktop/billing-access";
  import { ensureBillingProfile } from "$lib/stores/billing.store";

  let accessChecked = $state(false);
  let accessDenied = $state(false);
  let allowed = $state(false);

  async function checkAccess() {
    accessChecked = true;

    if (!browser || !isTauri()) {
      allowed = true;
      return;
    }

    const profile = await ensureBillingProfile();
    allowed = canAccessModuleByPlan(
      profile?.activePlanCode,
      "notes",
      profile?.hasActiveSubscription ?? false,
    );

    if (!allowed) {
      accessDenied = true;
      await goto("/pricing");
    }
  }

  onMount(() => {
    void checkAccess();
  });
</script>

{#if accessDenied}
  <section class="desktop-loading-shell surface-card">
    <p class="text-sm font-semibold text-[var(--foreground)]">Plan required</p>
    <p class="mt-2 text-sm text-[var(--muted)]">Upgrade your plan to access Notes.</p>
  </section>
{:else if allowed}
  <NotesApp moduleId="notes" />
{:else}
  <section class="desktop-loading-shell surface-card">
    <p class="text-sm font-medium text-[var(--muted)]">Checking access…</p>
  </section>
{/if}

<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import AuthLogo from "$lib/components/auth/AuthLogo.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { authStore } from "$lib/stores/auth.store";
  import { activeBundle, createTranslator } from "$lib/i18n";
  import { trackPageView, trackEvent } from "$lib/ipc";

  let _t = $derived.by(() => createTranslator($activeBundle));

  onMount(() => {
    trackPageView("auth");
  });

  function handleContinueDesktop() {
    trackEvent("auth", "continue_to_desktop");
    goto("/");
  }

  function handleViewPlans() {
    trackEvent("auth", "view_plans");
    goto("/pricing");
  }
</script>

<section class="desktop-gate">
  <Card class="desktop-gate__card">
    <CardHeader class="gap-4">
      <div class="flex items-center gap-3">
        <div class="desktop-gate__mark">
          <AuthLogo size={36} />
        </div>
        <div>
          <CardTitle class="font-[var(--font-heading)] text-3xl text-[var(--foreground)]">
            {_t('authWelcomeBack')}
          </CardTitle>
          <CardDescription class="mt-2 text-[var(--muted)]">
            {_t('authDesktopEntry')}
          </CardDescription>
        </div>
      </div>
    </CardHeader>
    <CardContent class="grid gap-5">
      {#if $authStore.message}
        <div class="desktop-gate__error" role="status" aria-live="polite">
          {$authStore.message}
        </div>
      {/if}
      <div class="grid gap-2">
        <Label for="email">{_t('commonEmail')}</Label>
        <Input id="email" placeholder="team@bento.local" />
      </div>
      <div class="grid gap-2">
        <Label for="password">{_t('commonPassword')}</Label>
        <Input id="password" type="password" placeholder="••••••••" />
      </div>
      <div class="flex flex-wrap gap-3">
        <Button class="rounded-full px-5" onclick={handleContinueDesktop}>{_t('authContinueToDesktop')}</Button>
        <Button class="rounded-full px-5" variant="outline" onclick={handleViewPlans}>
          {_t('authViewPlans')}
        </Button>
      </div>
    </CardContent>
  </Card>
</section>

<style>
  .desktop-gate {
    --background: oklch(0.139 0.005 262.802);
    --surface: oklch(0.177 0.009 264.318);
    --card: oklch(0.177 0.009 264.318);
    --foreground: oklch(0.976 0.001 286.376);
    --muted: oklch(0.693 0.01 273.297);
    --muted-foreground: oklch(0.693 0.01 273.297);
    --border: oklch(1 0 89.876 / 0.13);
    --input: oklch(1 0 89.876 / 0.07);
    --primary: oklch(0.976 0.001 286.376);
    --primary-foreground: oklch(0.139 0.005 262.802);
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--background);
    color: var(--foreground);
    padding: 1.5rem;
  }

  :global(.desktop-gate .desktop-gate__card) {
    border-color: var(--border);
    background: var(--card);
    color: var(--foreground);
    box-shadow: none !important;
  }

  .desktop-gate__mark {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    flex-shrink: 0;
  }

  .desktop-gate__error {
    background: oklch(0.637 0.208 25.331 / 0.1);
    border: 1px solid oklch(0.637 0.208 25.331 / 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    line-height: 1.5;
    color: oklch(0.637 0.208 25.331);
    text-align: center;
  }
</style>

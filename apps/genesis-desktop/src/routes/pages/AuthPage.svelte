<script lang="ts">
  import { goto } from "$app/navigation";
  import AuthLogo from "$lib/components/auth/AuthLogo.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { authStore } from "$lib/stores/auth.store";
  import { activeBundle, createTranslator } from "$lib/i18n";

  let _t = $derived.by(() => createTranslator($activeBundle));
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
        <Button class="rounded-full px-5" onclick={() => goto("/")}>{_t('authContinueToDesktop')}</Button>
        <Button class="rounded-full px-5" variant="outline" onclick={() => goto("/pricing")}>
          {_t('authViewPlans')}
        </Button>
      </div>
    </CardContent>
  </Card>
</section>

<style>
  .desktop-gate {
    --background: #08090b;
    --surface: #0f1115;
    --card: #0f1115;
    --foreground: #f7f7f8;
    --muted: #9a9ca3;
    --muted-foreground: #9a9ca3;
    --border: rgba(255, 255, 255, 0.13);
    --input: rgba(255, 255, 255, 0.07);
    --primary: #f7f7f8;
    --primary-foreground: #08090b;
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
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    line-height: 1.5;
    color: #ef4444;
    text-align: center;
  }
</style>

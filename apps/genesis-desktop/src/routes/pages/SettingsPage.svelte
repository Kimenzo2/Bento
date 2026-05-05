<script lang="ts">
  import ThemeSelector from "$lib/components/ThemeSelector.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { fontPairings, setFontPairing } from "$lib/stores/font.store";
  import { fontStore } from "$lib/stores/font.store";
  import { languageStore, languages, setLanguage } from "$lib/stores/language.store";
</script>

<Tabs.Root value="theme" class="grid gap-4">
  <Tabs.List class="w-fit rounded-full bg-[var(--surface)] p-1">
    <Tabs.Trigger class="rounded-full px-3 py-1.5 text-sm" value="theme">Theme</Tabs.Trigger>
    <Tabs.Trigger class="rounded-full px-3 py-1.5 text-sm" value="preferences">
      Preferences
    </Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="theme">
    <ThemeSelector />
  </Tabs.Content>

  <Tabs.Content value="preferences">
    <div class="grid gap-6 xl:grid-cols-2">
      <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
            Typography
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-5">
          <div class="grid gap-2">
            <p class="text-sm font-semibold text-[var(--foreground)]">Font pairing</p>
            <div class="flex flex-wrap gap-3">
              {#each fontPairings as pairing}
                <Button
                  class="rounded-full px-4"
                  variant={$fontStore.id === pairing.id ? "default" : "outline"}
                  onclick={() => setFontPairing(pairing.id)}
                >
                  {pairing.name}
                </Button>
              {/each}
            </div>
          </div>
          <div class="rounded-3xl app-surface p-5">
            <p class="font-[var(--font-heading)] text-3xl font-semibold text-[var(--foreground)]">
              Genesis typography preview
            </p>
            <p class="mt-2 text-sm text-[var(--muted)]">
              The desktop runtime applies the selected pairing at the document root.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
        <CardHeader>
          <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
            Local preferences
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-5">
          <div class="flex items-center justify-between rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
            <div>
              <p class="font-semibold text-[var(--foreground)]">Enable deep-link routing</p>
              <p class="text-sm text-[var(--muted)]">Handle `genesis://` links in the current shell.</p>
            </div>
            <Switch checked />
          </div>
          <div class="grid gap-2">
            <p class="text-sm font-semibold text-[var(--foreground)]">Language</p>
            <div class="flex gap-3">
              {#each languages as language}
                <Button
                  class="rounded-full px-4"
                  variant={$languageStore.code === language.code ? "default" : "outline"}
                  onclick={() => setLanguage(language.code)}
                >
                  {language.label}
                </Button>
              {/each}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </Tabs.Content>
</Tabs.Root>

<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
</script>

<section class="grid gap-6 xl:grid-cols-3">
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none xl:col-span-1">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Profile
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3 text-sm text-[var(--muted)]">
      <p><span class="font-semibold text-[var(--foreground)]">Workspace:</span> Genesis Desktop</p>
      <p><span class="font-semibold text-[var(--foreground)]">Tier:</span> Studio</p>
      <p><span class="font-semibold text-[var(--foreground)]">Storage:</span> 14.2 GB cached locally</p>
    </CardContent>
  </Card>

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

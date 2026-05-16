<script lang="ts">
  import { legalDocuments } from "$lib/data/app-data";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
</script>

<Tabs.Root value="privacy" class="grid gap-6">
  <Tabs.List class="w-fit rounded-full bg-[var(--surface)] p-1">
    {#each legalDocuments as document}
      <Tabs.Trigger class="rounded-full px-4" value={document.id}>{document.title}</Tabs.Trigger>
    {/each}
  </Tabs.List>

  {#each legalDocuments as document}
    <Tabs.Content value={document.id} class="rounded-[32px] border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_92%,transparent)] p-8">
      <h2 class="font-[var(--font-heading)] text-3xl font-semibold text-[var(--foreground)]">
        {document.title}
      </h2>
      <p class="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">{document.summary}</p>
    </Tabs.Content>
  {/each}
</Tabs.Root>

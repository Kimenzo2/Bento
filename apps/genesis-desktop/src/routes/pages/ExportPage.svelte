<script lang="ts">
  import { browser } from "$app/environment";
  import { BaseDirectory, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
  import { toast } from "svelte-sonner";
  import { exportFormats } from "$lib/data/app-data";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";

  let isExporting = $state(false);

  const startExport = async () => {
    if (!browser || !("__TAURI_INTERNALS__" in window)) {
      toast.info("Run this view inside the desktop shell to write export bundles.");
      return;
    }

    isExporting = true;

    try {
      const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
      const directory = "Genesis/exports";
      const filename = `${directory}/genesis-export-${timestamp}.json`;
      const payload = JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          presets: exportFormats,
          pipeline: ["print-pdf", "viewer-sequence", "asset-pack-manifest"],
        },
        null,
        2
      );

      await mkdir(directory, {
        baseDir: BaseDirectory.Download,
        recursive: true,
      });
      await writeTextFile(filename, payload, {
        baseDir: BaseDirectory.Download,
      });

      toast.success(`Export manifest saved to Downloads/${filename}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to write export manifest.");
    } finally {
      isExporting = false;
    }
  };
</script>

<section class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader>
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Export presets
      </CardTitle>
    </CardHeader>
    <CardContent class="grid gap-3">
      {#each exportFormats as format}
        <div class="rounded-2xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4">
          <p class="font-semibold text-[var(--foreground)]">{format.name}</p>
          <p class="mt-1 text-sm text-[var(--muted)]">{format.detail}</p>
        </div>
      {/each}
    </CardContent>
  </Card>

  <Card class="surface-card rounded-[32px] border-none bg-transparent shadow-none">
    <CardHeader class="flex-row items-center justify-between">
      <CardTitle class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Queue
      </CardTitle>
      <Button class="rounded-full px-5" disabled={isExporting} onclick={startExport}>
        {isExporting ? "Exporting..." : "Start export"}
      </Button>
    </CardHeader>
    <CardContent class="grid gap-3">
      {#each ["Print PDF bundle", "Viewer image sequence", "Asset pack manifest"] as task}
        <div class="rounded-2xl app-surface p-4">
          <p class="font-semibold text-[var(--foreground)]">{task}</p>
          <p class="mt-1 text-sm text-[var(--muted)]">
            Filesystem write access is scoped through Tauri capabilities for export-safe destinations.
          </p>
        </div>
      {/each}
    </CardContent>
  </Card>
</section>

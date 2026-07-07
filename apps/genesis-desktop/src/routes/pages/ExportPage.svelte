<script lang="ts">
  import { browser } from "$app/environment";
  import { time } from "$lib/utils/time";
  import { toast } from "svelte-sonner";
  import { isTauri } from "@tauri-apps/api/core";
  import { exportFormats } from "$lib/data/app-data";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { pickExportDirectory, saveExportManifest } from "$lib/desktop/runtime";
  import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";

  let isExporting = $state(false);
  let isChoosingFolder = $state(false);

  const startExport = async () => {
    if (!browser || !isTauri()) {
      toast.info("Run this view inside the desktop shell to write export bundles.");
      return;
    }

    isExporting = true;

    try {
      const timestamp = time.toISODateTime(time.now()).replaceAll(":", "-").replaceAll(".", "-");
      const savedPath = await saveExportManifest({
        createdAt: time.toISODateTime(time.now()),
        presets: exportFormats,
        pipeline: ["print-pdf", "viewer-sequence", "asset-pack-manifest"],
      });

      if (savedPath) {
        toast.success(`Export manifest saved to ${savedPath}`);
      } else {
        toast.info("Export cancelled.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to write export manifest.");
    } finally {
      isExporting = false;
    }
  };

  const chooseExportDirectory = async () => {
    if (!browser || !isTauri()) {
      toast.info("Run this view inside the desktop shell to choose an export folder.");
      return;
    }

    isChoosingFolder = true;

    try {
      const directory = await pickExportDirectory();
      if (!directory) {
        toast.info("Export folder selection cancelled.");
        return;
      }

      await updateDesktopSettings((current) => ({
        ...current,
        files: {
          ...current.files,
          exportDirectory: directory,
        },
      }));

      toast.success(`Bento export folder set to ${directory}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the export folder.");
    } finally {
      isChoosingFolder = false;
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
      <div class="flex gap-3">
        <Button class="rounded-full px-5" disabled={isChoosingFolder} variant="outline" onclick={chooseExportDirectory}>
          {isChoosingFolder ? "Choosing..." : "Export folder"}
        </Button>
        <Button class="rounded-full px-5" disabled={isExporting} onclick={startExport}>
          {isExporting ? "Exporting..." : "Start export"}
        </Button>
      </div>
    </CardHeader>
    <CardContent class="grid gap-3">
      <div class="rounded-2xl app-surface p-4">
        <p class="font-semibold text-[var(--foreground)]">Current export folder</p>
        <p class="mt-1 break-all text-sm text-[var(--muted)]">
          {$desktopSettings.files.exportDirectory || "Downloads/Bento/exports"}
        </p>
      </div>
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

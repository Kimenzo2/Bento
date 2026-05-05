<script lang="ts">
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { clearCrash, crashStore } from "$lib/stores/crash.store";

  const open = $derived(Boolean($crashStore));

  const copyLog = async () => {
    if (!$crashStore) {
      return;
    }

    const value = `Crash time: ${$crashStore.timestamp}\nLog path: ${$crashStore.logPath}\nMessage: ${$crashStore.message}`;

    if ("__TAURI_INTERNALS__" in window) {
      await writeText(value);
      return;
    }

    await navigator.clipboard.writeText(value);
  };
</script>

<Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && clearCrash()}>
  <Dialog.Content class="max-w-xl rounded-[28px] border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[var(--surface)]">
    <Dialog.Header>
      <Dialog.Title class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Genesis recovered from a crash
      </Dialog.Title>
      <Dialog.Description class="text-[var(--muted)]">
        {$crashStore?.message ?? "The Rust backend reported an unrecoverable error."}
      </Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] p-4 text-sm text-[var(--muted)]">
      <p><span class="font-semibold text-[var(--foreground)]">Log:</span> {$crashStore?.logPath}</p>
      <p><span class="font-semibold text-[var(--foreground)]">Time:</span> {$crashStore?.timestamp}</p>
    </div>

    <Dialog.Footer class="gap-3">
      <Button class="rounded-full px-4" variant="outline" onclick={copyLog}>Copy Log</Button>
      <Button class="rounded-full px-4" onclick={clearCrash}>Dismiss</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

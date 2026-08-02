<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { clearCrash, crashStore } from "$lib/stores/crash.store";

  const open = $derived(Boolean($crashStore));

  const copyLog = async () => {
    if (!$crashStore) {
      return;
    }

    const value = `Crash time: ${$crashStore.timestamp}\nLog path: ${$crashStore.logPath}\nMessage: ${$crashStore.message}`;

    await navigator.clipboard.writeText(value);
  };
</script>

<Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && clearCrash()}>
  <Dialog.Content class="max-w-xl rounded-[28px] border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-[var(--surface)]">
    <Dialog.Header>
      <Dialog.Title class="font-[var(--font-heading)] text-2xl text-[var(--foreground)]">
        Bento recovered from a crash
      </Dialog.Title>
      <Dialog.Description class="text-[var(--muted)]">
        {$crashStore?.message ?? "The app encountered an unrecoverable error."}
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

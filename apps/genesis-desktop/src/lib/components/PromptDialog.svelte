<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  let {
    open = $bindable(false),
    title = "Input",
    description = "",
    placeholder = "",
    initialValue = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onconfirm,
    oncancel,
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    placeholder?: string;
    initialValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onconfirm?: (value: string) => void;
    oncancel?: () => void;
  } = $props();

  let value = $state('');
  let inputEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (open) {
      value = initialValue;
      // Focus input after dialog renders
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  function handleConfirm() {
    onconfirm?.(value);
  }

  function handleCancel() {
    oncancel?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && value.trim()) {
      handleConfirm();
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      handleCancel();
    }
  }
</script>

<Dialog bind:open>
  <DialogContent class="prompt-dialog" onkeydown={handleKeydown} data-dialog-content>
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      {#if description}
        <DialogDescription>{description}</DialogDescription>
      {/if}
    </DialogHeader>

    <div class="prompt-dialog__body">
      <input
        bind:this={inputEl}
        bind:value
        class="prompt-dialog__input"
        type="text"
        {placeholder}
        onkeydown={handleKeydown}
      />
    </div>

    <div class="prompt-dialog__footer">
      <Button variant="ghost" onclick={handleCancel}>{cancelLabel}</Button>
      <Button disabled={!value.trim()} onclick={handleConfirm}>{confirmLabel}</Button>
    </div>
  </DialogContent>
</Dialog>

<style>
  :global(.prompt-dialog) {
    width: min(24rem, calc(100vw - 2rem));
  }

  .prompt-dialog__body {
    padding: 0 1.5rem 0.5rem;
  }

  .prompt-dialog__input {
    width: 100%;
    border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--surface) 94%, var(--background));
    color: var(--foreground);
    padding: 0.65rem 0.85rem;
    font-size: 0.9rem;
    outline: none;
    box-sizing: border-box;
    transition: border-color 150ms ease;
  }

  .prompt-dialog__input:focus {
    border-color: var(--primary);
  }

  .prompt-dialog__input::placeholder {
    color: var(--muted);
  }

  .prompt-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.5rem 1.5rem 1.25rem;
  }
</style>

<script lang="ts">
  import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  } from '$lib/components/ui/dialog/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { shareContent, copyToClipboard, type ShareFormat, type ShareResult } from '$lib/services/share-service';
  import { Clipboard, Download, FileText, Check, Loader2, AlertCircle, Share2 } from 'lucide-svelte';

  interface Props {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    /** The raw text content to share (markdown, plain text, etc.) */
    content: string;
    /** A human-readable label for what's being shared */
    label?: string;
    /** Default filename (without extension) for file exports */
    filename?: string;
    /** Array of allowed formats. Defaults to all. */
    allowedFormats?: ShareFormat[];
    /** Custom title for the share dialog */
    title?: string;
    /** Custom description */
    description?: string;
    /** Callback after a successful share */
    onSuccess?: (result: ShareResult) => void;
  }

  let {
    open = $bindable(false),
    onOpenChange,
    content,
    label = 'Shared content',
    filename = 'bento-export',
    allowedFormats = ['markdown', 'json', 'csv', 'plainText'],
    title = 'Share',
    description = 'Choose how to share this content.',
    onSuccess,
  }: Props = $props();

  let isSharing = $state(false);
  let shareError = $state<string | null>(null);
  let lastResult = $state<ShareResult | null>(null);

  const formatLabels: Record<ShareFormat, { name: string; icon: any; extension: string }> = {
    plainText: { name: 'Plain Text', icon: FileText, extension: 'txt' },
    markdown:  { name: 'Markdown',   icon: FileText, extension: 'md' },
    json:      { name: 'JSON',       icon: FileText, extension: 'json' },
    html:      { name: 'HTML',       icon: FileText, extension: 'html' },
    csv:       { name: 'CSV',        icon: FileText, extension: 'csv' },
    bentoManifest: { name: 'Bento Manifest', icon: FileText, extension: 'json' },
  };

  async function handleCopy(format: ShareFormat) {
    isSharing = true;
    shareError = null;
    lastResult = null;
    try {
      const result = await shareContent(content, format, 'clipboard', { label, filename });
      lastResult = result;
      onSuccess?.(result);
    } catch (err: any) {
      shareError = err?.toString() ?? 'Failed to copy.';
    } finally {
      isSharing = false;
    }
  }

  async function handleSaveFile(format: ShareFormat) {
    isSharing = true;
    shareError = null;
    lastResult = null;
    try {
      const result = await shareContent(content, format, 'file', { label, filename });
      lastResult = result;
      onSuccess?.(result);
    } catch (err: any) {
      shareError = err?.toString() ?? 'Failed to save file.';
    } finally {
      isSharing = false;
    }
  }

  function reset() {
    isSharing = false;
    shareError = null;
    lastResult = null;
  }

  $effect(() => {
    if (!open) reset();
  });
</script>

<Dialog {open} onOpenChange={onOpenChange}>
  <DialogContent class="max-w-sm">
    <DialogHeader>
      <DialogTitle>
        <div class="flex items-center gap-2">
          <Share2 size={16} />
          {title}
        </div>
      </DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>

    <div class="flex flex-col gap-2">
      {#if shareError}
        <div class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle size={14} />
          <span>{shareError}</span>
        </div>
      {/if}

      {#if lastResult}
        <div class="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
          <Check size={14} />
          <span>{lastResult.message}</span>
        </div>
      {/if}

      {#each allowedFormats as format}
        {@const fmt = formatLabels[format]}
        <div class="flex items-center gap-2 rounded-xl border border-border/60 bg-surface/50 p-1">
          <div class="flex flex-1 items-center gap-2 px-2">
            <svelte:component this={fmt.icon} size={14} class="text-muted-foreground shrink-0" />
            <span class="text-xs font-medium">{fmt.name}</span>
            <span class="text-[10px] text-muted-foreground">.{fmt.extension}</span>
          </div>
          <div class="flex gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={isSharing}
              onclick={() => handleCopy(format)}
              title="Copy to clipboard"
            >
              {#if isSharing}<Loader2 size={12} class="animate-spin" />{:else}<Clipboard size={12} />{/if}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={isSharing}
              onclick={() => handleSaveFile(format)}
              title="Save as file"
            >
              {#if isSharing}<Loader2 size={12} class="animate-spin" />{:else}<Download size={12} />{/if}
            </Button>
          </div>
        </div>
      {/each}
    </div>

    <div class="flex items-center justify-between border-t border-border/40 pt-3">
      <span class="text-[10px] text-muted-foreground">
        {label}
        {#if lastResult}
          · {lastResult.sizeBytes > 1024
            ? `${(lastResult.sizeBytes / 1024).toFixed(1)} KB`
            : `${lastResult.sizeBytes} B`}
        {/if}
      </span>
    </div>
  </DialogContent>
</Dialog>

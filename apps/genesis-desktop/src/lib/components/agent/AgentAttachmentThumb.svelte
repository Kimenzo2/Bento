<script lang="ts">
  import type { Attachment } from "$lib/stores/agent-morph.svelte";
  import CameraIcon from "@lucide/svelte/icons/camera";
  import ImageIcon from "@lucide/svelte/icons/image";
  import FileIcon from "@lucide/svelte/icons/file";
  import XIcon from "@lucide/svelte/icons/x";

  let {
    attachment,
    onremove,
  }: {
    attachment: Attachment;
    onremove: (id: string) => void;
  } = $props();

  let icon = $derived.by(() => {
    if (attachment.kind === "image") {
      if (attachment.name === "Camera") return CameraIcon;
      return ImageIcon;
    }
    return FileIcon;
  });
</script>

<div class="attach-thumb">
  <svelte:component this={icon} size={16} />
  {#if attachment.name}
    <span class="attach-thumb__name">{attachment.name}</span>
  {/if}
  <button
    class="attach-thumb__remove"
    onclick={() => onremove(attachment.id)}
    aria-label="Remove {attachment.name ?? 'attachment'}"
  >
    <XIcon size={10} />
  </button>
</div>

<style>
  .attach-thumb {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 8px 0 10px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
    background: color-mix(in srgb, var(--foreground) 6%, var(--background));
    color: var(--muted);
    font-size: 13px;
    font-family: inherit;
    white-space: nowrap;
    user-select: none;
    flex-shrink: 0;
    transition: border-color 0.15s ease;
    animation: thumb-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes thumb-in {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .attach-thumb:hover {
    border-color: color-mix(in srgb, var(--foreground) 24%, transparent);
  }

  .attach-thumb__name {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .attach-thumb__remove {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    margin-left: 2px;
    margin-right: -4px;
    border: none;
    border-radius: 8px;
    background: color-mix(in srgb, var(--foreground) 14%, transparent);
    color: var(--foreground);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;
  }

  .attach-thumb__remove::before {
    content: "";
    position: absolute;
    inset: -12px;
  }

  .attach-thumb:hover .attach-thumb__remove {
    opacity: 1;
  }

  .attach-thumb__remove:hover {
    background: color-mix(in srgb, var(--foreground) 24%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .attach-thumb {
      animation: none;
    }
  }
</style>

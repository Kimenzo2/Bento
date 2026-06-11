<script lang="ts">
  import { invoke, convertFileSrc } from "@tauri-apps/api/core";
  import ImageIcon from "@lucide/svelte/icons/image";

  let {
    hash,
    alt = "",
    immediate = false,
    ...restProps
  }: {
    hash: string;
    alt?: string;
    immediate?: boolean;
  } & Record<string, unknown> = $props();

  let containerRef = $state<HTMLDivElement | null>(null);
  let inView = $state(immediate);
  let imageSrc = $state<string | null>(null);
  let error = $state(false);
  let generation = $state(0);

  // Track viewport visibility — only fetch image path when visible
  $effect(() => {
    if (inView) return;
    if (!containerRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          inView = true;
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(containerRef);
    return () => observer.disconnect();
  });

  // Fetch image file path only when in view — use asset protocol (no base64!)
  $effect(() => {
    if (!inView || !hash) return;

    generation++;
    const currentGen = generation;
    error = false;

    invoke<string | null>("clipboard_get_image_path", { hash })
      .then((filePath) => {
        if (currentGen !== generation) return;
        if (filePath) {
          imageSrc = convertFileSrc(filePath);
        } else {
          error = true;
        }
      })
      .catch(() => {
        if (currentGen === generation) error = true;
      });
  });
</script>

<div bind:this={containerRef} style="display:contents">
  {#if !inView}
    <div class="cb-image-skeleton" {...restProps}></div>
  {:else if imageSrc}
    <img src={imageSrc} alt={alt} {...restProps} />
  {:else if error}
    <div class="cb-image-fallback" {...restProps}>
      <ImageIcon size={24} />
    </div>
  {:else}
    <div class="cb-image-skeleton" {...restProps}></div>
  {/if}
</div>

<style>
  :global(.cb-image-skeleton) {
    width: 100%;
    min-height: 120px;
    background: color-mix(in srgb, var(--cb-ink) 4%, transparent);
    border-radius: inherit;
    animation: cb-pulse 1.5s ease-in-out infinite;
  }

  :global(.cb-image-fallback) {
    width: 100%;
    min-height: 120px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--cb-ink) 4%, transparent);
    border-radius: inherit;
    opacity: 0.3;
  }

  @keyframes cb-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
</style>

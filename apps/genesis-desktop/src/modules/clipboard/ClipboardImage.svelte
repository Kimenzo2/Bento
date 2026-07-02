<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import ImageIcon from "@lucide/svelte/icons/image";

  let {
    hash,
    alt = "",
    immediate = false,
    imagePath = null,
    ...restProps
  }: {
    hash: string;
    alt?: string;
    immediate?: boolean;
    imagePath?: string | null;
  } & Record<string, unknown> = $props();

  let inView = $state(false);
  let imageSrc = $state<string | null>(null);
  let error = $state(false);
  let observerTarget = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (immediate) inView = true;
  });

  $effect(() => {
    if (inView || !observerTarget) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          inView = true;
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(observerTarget);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!inView || !hash) return;
    error = false;
    if (imagePath) {
      try {
        imageSrc = convertFileSrc(imagePath);
      } catch {
        error = true;
      }
    } else {
      error = true;
    }
  });
</script>

{#if !inView}
  <div bind:this={observerTarget} class="cb-image-skeleton" {...restProps}></div>
{:else if imageSrc}
  <img src={imageSrc} alt={alt} decoding="async" onerror={() => { error = true; }} {...restProps} />
{:else if error}
  <div class="cb-image-fallback" {...restProps}>
    <ImageIcon size={24} />
  </div>
{:else}
  <div bind:this={observerTarget} class="cb-image-skeleton" {...restProps}></div>
{/if}

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

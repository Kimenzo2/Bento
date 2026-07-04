<script lang="ts">
  import { convertFileSrc, invoke } from "@tauri-apps/api/core";
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
  let loading = $state(true);
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

  let loadingPath = $state(false);

  $effect(() => {
    if (!inView || !hash) return;
    if (imageSrc) return;

    if (imagePath) {
      loading = false;
      try {
        imageSrc = convertFileSrc(imagePath);
      } catch {
        error = true;
      }
      return;
    }

    // Lazy-load image path from backend if not cached
    if (loadingPath) return;
    loadingPath = true;
    invoke<string | null>("clipboard_get_image_path", { hash })
      .then((path) => {
        loading = false;
        if (path) {
          try {
            imageSrc = convertFileSrc(path);
          } catch {
            error = true;
          }
        } else {
          error = true;
        }
      })
      .catch(() => {
        loading = false;
        error = true;
      });
  });
</script>

{#if !inView || loading}
  <div bind:this={observerTarget} class="cb-image-skeleton" {...restProps}></div>
{:else if imageSrc}
  <img src={imageSrc} alt={alt} decoding="async" onerror={() => { error = true; }} {...restProps} />
{:else if error}
  <div class="cb-image-fallback" {...restProps}>
    <ImageIcon size={24} />
  </div>
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

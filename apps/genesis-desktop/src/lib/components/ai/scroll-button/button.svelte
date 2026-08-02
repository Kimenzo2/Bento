<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { getContext } from "svelte";
  import type { ScrollButtonContext } from "./root.svelte";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";

  // ── Props ─────────────────────────────────────────────────────
  let {
    label = "Scroll to latest",
    position = "bottom-right",
    class: className = "",
    variant = "default",
  }: {
    label?: string;
    position?: "bottom-right" | "bottom-center" | "bottom-left";
    class?: string;
    variant?: "default" | "pill";
  } = $props();

  // ── Context ───────────────────────────────────────────────────
  const ctx = getContext<ScrollButtonContext>("scroll-button");

  // ── In-view animation ─────────────────────────────────────────
  // Only show the button when the user has scrolled up (not at bottom)
  const visible = $derived(!ctx.isAtBottom);

  const containerClass = $derived.by(() => {
    const parts = ["scroll-btn"];
    if (variant === "pill") parts.push("scroll-btn--pill");
    if (position === "bottom-right") parts.push("scroll-btn--bottom-right");
    if (position === "bottom-center") parts.push("scroll-btn--bottom-center");
    if (position === "bottom-left") parts.push("scroll-btn--bottom-left");
    if (className) parts.push(className);
    return parts.join(" ");
  });
</script>

{#if visible}
  <div
    class={containerClass}
  >
    <button
      type="button"
      class="scroll-btn__button"
      onclick={ctx.scrollToBottom}
      aria-label={label}
    >
      <ChevronDownIcon size={14} />
      <span class="scroll-btn__label">{label}</span>
    </button>
  </div>
{/if}

<style>
  .scroll-btn {
    z-index: 10;
    pointer-events: none;
    position: sticky;
    animation: scroll-btn-in 0.2s ease both;
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-btn {
      animation: none;
    }
  }

  @keyframes scroll-btn-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .scroll-btn--bottom-right {
    display: flex;
    justify-content: flex-end;
  }

  .scroll-btn--bottom-center {
    display: flex;
    justify-content: center;
  }

  .scroll-btn--bottom-left {
    display: flex;
    justify-content: flex-start;
  }

  .scroll-btn__button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--foreground) 15%, transparent);
    background: color-mix(in srgb, var(--background) 92%, var(--foreground));
    color: var(--muted);
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    pointer-events: auto;
    user-select: none;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    box-shadow: var(--shadow-xs);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .scroll-btn__button:hover {
    background: color-mix(in srgb, var(--background) 85%, var(--foreground));
    color: var(--foreground);
    border-color: color-mix(in srgb, var(--foreground) 25%, transparent);
    box-shadow: var(--shadow-sm);
  }

  .scroll-btn__button:active {
    transform: scale(0.97);
  }

  .scroll-btn__button:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .scroll-btn__label {
    white-space: nowrap;
  }

  /* ── Pill variant ─────────────────────────────────────────── */
  .scroll-btn--pill .scroll-btn__button {
    border-radius: 9999px;
    padding: 6px 16px;
    font-size: 13px;
  }

  .scroll-btn--pill .scroll-btn__button:hover {
    background: color-mix(in srgb, var(--foreground) 12%, var(--background));
  }
</style>

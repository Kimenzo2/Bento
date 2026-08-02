<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { setContext, tick } from "svelte";

  // ── Context type ──────────────────────────────────────────────
  export interface ScrollButtonContext {
    registerContent: (el: HTMLDivElement) => void;
    scrollToBottom: () => void;
    isAtBottom: boolean;
    shouldAutoScroll: boolean;
  }

  const CONTEXT_KEY = "scroll-button";

  // ── Props ─────────────────────────────────────────────────────
  let {
    children,
    threshold = 80,
    class: className = "",
    autoScroll = true,
  }: {
    children: import("svelte").Snippet;
    threshold?: number;
    class?: string;
    autoScroll?: boolean;
  } = $props();

  // ── State ─────────────────────────────────────────────────────
  let contentEl = $state<HTMLDivElement | null>(null);
  let isAtBottom = $state(true);
  let userInteracted = $state(false);
  let rafId = 0;
  let shouldReduceMotion = $state(false);

  // Check reduced motion preference
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    shouldReduceMotion = mq.matches;
    const handler = (e: MediaQueryListEvent) => (shouldReduceMotion = e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  // ── Scroll position check ─────────────────────────────────────
  function checkAtBottom() {
    if (!contentEl) return;
    const dist =
      contentEl.scrollHeight -
      contentEl.scrollTop -
      contentEl.clientHeight;
    isAtBottom = dist < threshold;
  }

  // ── Scroll to bottom ──────────────────────────────────────────
  function scrollToBottom() {
    if (!contentEl?.isConnected) return;
    userInteracted = false;
    isAtBottom = true;
    contentEl.scrollTo({
      top: contentEl.scrollHeight,
      behavior: shouldReduceMotion ? "instant" : "smooth",
    });
  }

  // ── Register content element ──────────────────────────────────
  function registerContent(el: HTMLDivElement) {
    contentEl = el;

    // Re-check on content resize
    const ro = new ResizeObserver(() => {
      if (!contentEl) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!autoScroll) return;
        if (!userInteracted || isAtBottom) {
          contentEl?.scrollTo({
            top: contentEl.scrollHeight,
            behavior: shouldReduceMotion ? "instant" : "smooth",
          });
        }
      });
    });
    ro.observe(el);

    // Scroll events
    el.addEventListener("scroll", () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        checkAtBottom();
        if (!isAtBottom) {
          userInteracted = true;
        }
      });
    });

    // Re-check on window resize
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        checkAtBottom();
        if (autoScroll && (isAtBottom || !userInteracted)) {
          el?.scrollTo({
            top: el.scrollHeight,
            behavior: shouldReduceMotion ? "instant" : "smooth",
          });
        }
      });
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    $effect(() => {
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(rafId);
      };
    });
  }

  // ── Expose context to children ────────────────────────────────
  setContext<ScrollButtonContext>(CONTEXT_KEY, {
    registerContent,
    scrollToBottom,
    get isAtBottom() {
      return isAtBottom;
    },
    get shouldAutoScroll() {
      return autoScroll && (isAtBottom || !userInteracted);
    },
  });
</script>

<div class={className}>
  {@render children()}
</div>

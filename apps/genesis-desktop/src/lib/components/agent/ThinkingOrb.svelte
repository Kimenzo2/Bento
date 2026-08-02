<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { resolvePreset, MODE_DRAWS } from "thinking-orbs";

  let {
    orbState = "working",
    size = 64,
    theme = "auto",
    speed = 1,
    paused = false,
    "aria-label": ariaLabel,
    ...rest
  }: {
    orbState?: "working" | "searching" | "solving" | "listening" | "composing" | "shaping";
    size?: 20 | 64;
    theme?: "auto" | "dark" | "light";
    speed?: number;
    paused?: boolean;
    "aria-label"?: string;
    [key: string]: unknown;
  } = $props();

  const LABELS: Record<string, string> = {
    working: "Working…",
    searching: "Searching…",
    solving: "Solving…",
    listening: "Listening…",
    composing: "Composing…",
    shaping: "Shaping…",
  };

  let canvas = $state<HTMLCanvasElement | null>(null);
  let raf = $state(0);

  function resolveDark(): boolean {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    if (typeof document === "undefined") return false;
    let el: HTMLElement | null = document.documentElement;
    while (el) {
      const dt = el.getAttribute("data-theme");
      if (dt === "dark" || dt === "light") return dt === "dark";
      if (el.classList.contains("dark")) return true;
      if (el.classList.contains("light")) return false;
      el = el.parentElement;
    }
    return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
  }

  $effect(() => {
    const c = canvas;
    if (!c || paused) return;

    const dark = resolveDark();
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const { mode, speed: baseSpeed, opts } = resolvePreset(orbState, size);
    const draw = MODE_DRAWS[mode];
    if (!draw) return;

    const dpr = Math.min(2, typeof devicePixelRatio !== "undefined" && devicePixelRatio || 1);
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const effectiveSpeed = baseSpeed * speed;

    function paint(t: number) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, size, size);
      draw(ctx!, size, t, dark, opts);
    }

    if (reduced) {
      paint(0.6);
      return;
    }

    let running = false;
    let visible = true;

    function start() { if (!running) { running = true; tick(); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    const tick = () => {
      if (!running) return;
      paint(performance.now() / 1000 * effectiveSpeed);
      raf = requestAnimationFrame(tick);
    };

    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && document.visibilityState !== "hidden") start();
          else stop();
        })
      : null;
    if (observer) observer.observe(c);

    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVis);

    start();

    const mq = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;
    const onTheme = () => {};
    mq?.addEventListener("change", onTheme);
    let mo: MutationObserver | null = null;
    if (theme === "auto" && typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(onTheme);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"], subtree: true });
    }

    return () => {
      stop();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq?.removeEventListener("change", onTheme);
      mo?.disconnect();
    };
  });
</script>

<canvas
  bind:this={canvas}
  role="img"
  aria-label={ariaLabel ?? LABELS[orbState] ?? "Working…"}
  style="width: {size}px; height: {size}px; display: block;"
  {...rest}
></canvas>

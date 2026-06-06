<!--
  TiltCard.svelte
  Full-screen celebration popup with 3D tilt on the card.
  Dominates the screen — user can only focus on the celebration.
  
  Usage:
    <TiltCard open={true} onClose={() => {}} maxTilt={25}>
      ...card content...
    </TiltCard>
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open      = false,
    onClose   = () => {},
    maxTilt   = 25,
    children,
  }: {
    open?:     boolean;
    onClose?:  () => void;
    maxTilt?:  number;
    children?: Snippet;
  } = $props();

  let cardEl: HTMLDivElement | undefined = $state();
  let rx = $state(0);
  let ry = $state(0);
  let hx = $state(50);
  let hy = $state(50);
  let active = $state(false);

  function onMouseMove(e: MouseEvent) {
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top)  / rect.height;
    ry =  (px - 0.5) * 2 * maxTilt;
    rx = -(py - 0.5) * 2 * maxTilt;
    hx = px * 100;
    hy = py * 100;
  }

  function onMouseEnter() { active = true; }
  function onMouseLeave() { active = false; rx = 0; ry = 0; hx = 50; hy = 50; }

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('tc-backdrop')) onClose();
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  // Export playSound so parent can call it directly inside the click handler
  export { playSound };
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="tc-backdrop"
    onclick={handleBackdrop}
    onkeydown={handleKey}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- The actual card — w-64 sm:w-80 equivalent, centered -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={cardEl}
      class="tc-card"
      style="
        transform: {active
          ? `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`
          : 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)'};
        transition: {active
          ? 'transform 80ms linear'
          : 'transform 400ms cubic-bezier(0.23,1,0.32,1)'};
      "
      onmousemove={onMouseMove}
      onmouseenter={onMouseEnter}
      onmouseleave={onMouseLeave}
    >
      <!-- Gloss highlight that follows cursor -->
      <div
        class="tc-highlight"
        style="
          opacity: {active ? 1 : 0};
          background: radial-gradient(circle at {hx}% {hy}%, rgba(255,255,255,0.15) 0%, transparent 60%);
        "
      ></div>

      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  /* Full-screen takeover — nothing else is reachable */
  .tc-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: color-mix(in srgb, var(--background) 60%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    animation: tc-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes tc-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* The card itself — matches w-64 / sm:w-80 from the example */
  .tc-card {
    position: relative;
    width: min(320px, calc(100vw - 3rem));
    background: var(--card, var(--background));
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 1rem;
    will-change: transform;
    transform-style: preserve-3d;
    animation: tc-card-in 350ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes tc-card-in {
    from { opacity: 0; transform: perspective(800px) scale(0.88) translateY(24px); }
    to   { opacity: 1; transform: perspective(800px) scale(1)    translateY(0); }
  }

  /* Gloss layer */
  .tc-highlight {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    z-index: 1;
    transition: opacity 120ms;
  }
</style>

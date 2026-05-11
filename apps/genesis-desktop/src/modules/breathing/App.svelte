<script lang="ts">
  const modes = ["Box 4-4-4-4", "4-7-8 reset", "Physiological sigh", "Coherent breathing"];
</script>

<main class="breath-app module-root">
  <header>
    <strong>Calm Lab</strong>
    <nav><span>Breathe</span><span>Sessions</span><span>Sounds</span><span>Check-ins</span></nav>
  </header>
  <section>
    <article class="breath-orb">
      <h1>Box Breathing</h1>
      <div>04<small>inhale</small></div>
      <button>Start</button>
    </article>
    <article class="breath-modes">
      <h2>Exercises</h2>
      {#each modes as mode}
        <p>{mode}<button>Open</button></p>
      {/each}
    </article>
    <article class="breath-stats">
      <h2>Session streak</h2>
      <strong>18 days</strong>
      <i></i>
    </article>
    <article class="breath-check">
      <h2>Anxiety check-in</h2>
      <p>Current level <b>3.2</b></p>
      <p>After session target <b>1.8</b></p>
    </article>
  </section>
</main>

<style>
  .breath-app {
    --breath-bg: var(--background);
    --breath-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --breath-surface-strong: color-mix(in srgb, var(--surface) 88%, var(--background));
    --breath-ink: var(--foreground);
    --breath-muted: var(--muted);
    --breath-border: var(--border);
    --breath-accent: var(--primary);
    --breath-accent-soft: color-mix(in srgb, var(--accent) 56%, var(--primary));
    min-height: 100%;
    padding: 38px;
    background: var(--breath-bg);
    color: var(--breath-ink);
    font-family: "Outfit", sans-serif;
  }

  .breath-app header {
    display: flex;
    align-items: center;
  }

  .breath-app strong {
    font-size: 22px;
  }

  .breath-app nav {
    display: flex;
    gap: 12px;
    margin-left: auto;
  }

  .breath-app nav span {
    padding: 12px 20px;
    border: 1px solid var(--breath-border);
    border-radius: 999px;
    background: var(--breath-surface);
  }

  .breath-app nav span:first-child {
    background: var(--breath-ink);
    color: var(--breath-bg);
    border-color: color-mix(in srgb, var(--breath-ink) 68%, var(--breath-border));
  }

  .breath-app section {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr;
    gap: 18px;
    margin-top: 48px;
  }

  .breath-app article {
    padding: 28px;
    border: 1px solid var(--breath-border);
    border-radius: 28px;
    background: var(--breath-surface);
  }

  .breath-orb {
    grid-row: span 2;
    text-align: center;
    background:
      linear-gradient(
        160deg,
        var(--breath-surface),
        color-mix(in srgb, var(--breath-accent) 22%, var(--breath-surface-strong))
      ) !important;
  }

  .breath-orb h1 {
    font-size: 42px;
  }

  .breath-orb div {
    display: grid;
    place-items: center;
    width: 320px;
    height: 320px;
    margin: 40px auto;
    border-radius: 50%;
    background:
      radial-gradient(
        circle,
        var(--breath-surface) 0 42%,
        color-mix(in srgb, var(--breath-accent) 72%, var(--breath-surface)) 43% 44%,
        color-mix(in srgb, var(--breath-accent) 22%, var(--breath-surface)) 45%
      );
    font-size: 70px;
  }

  .breath-orb small {
    font-size: 16px;
    color: var(--breath-muted);
  }

  .breath-orb button {
    padding: 16px 44px;
    border: 1px solid color-mix(in srgb, var(--breath-accent) 48%, var(--breath-border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--breath-accent) 34%, var(--breath-surface));
    color: var(--breath-ink);
    cursor: default;
  }

  .breath-modes p {
    display: flex;
    justify-content: space-between;
    padding: 15px 0;
    border-bottom: 1px solid var(--breath-border);
  }

  .breath-modes button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: default;
  }

  .breath-stats strong {
    display: block;
    font-size: 48px;
  }

  .breath-stats i {
    display: block;
    height: 16px;
    margin-top: 40px;
    border-radius: 999px;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--breath-accent) 70%, var(--breath-accent-soft)) 72%,
        color-mix(in srgb, var(--breath-border) 78%, transparent) 0
      );
  }

  .breath-check p {
    display: flex;
    justify-content: space-between;
    padding: 18px;
    border: 1px solid var(--breath-border);
    border-radius: 18px;
    background: var(--breath-surface-strong);
  }
</style>



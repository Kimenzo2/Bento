<script lang="ts"></script>

<main class="voice-app module-root">
  <aside>
    {#each ["Home", "Calendar", "Insights", "Record", "Tags"] as x}
      <button class:voice-on={x === "Home"}>{x[0]}</button>
    {/each}
  </aside>
  <section>
    <header>
      <h1>Good morning, Amara</h1>
      <p><button>Record</button><button>Transcribe</button></p>
    </header>
    <div class="voice-grid">
      <article class="voice-large">
        <h2>Recent Recordings</h2>
        <strong>Board review for client launch</strong>
        <span>18:42</span>
        <footer>Product Research Action</footer>
      </article>
      <article class="voice-transcript">
        <small>Jul 15</small>
        <h2>Championship Viewing Party</h2>
        <p>Speaker labels and summary sections are ready for export.</p>
      </article>
      <article class="voice-number">
        <span>345</span>
        <small>Minutes transcribed</small>
      </article>
      <article class="voice-number">
        <span>4,569</span>
        <small>Total recordings</small>
      </article>
    </div>
    <button class="voice-fab">Record</button>
  </section>
</main>

<style>
  .voice-app {
    --voice-bg: var(--background);
    --voice-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --voice-surface-strong: color-mix(in srgb, var(--surface) 86%, var(--background));
    --voice-ink: var(--foreground);
    --voice-muted: var(--muted);
    --voice-border: var(--border);
    --voice-accent: var(--primary);
    --voice-accent-b: var(--accent);
    min-height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    padding: 34px;
    background: var(--voice-bg);
    color: var(--voice-ink);
    font-family: "Manrope", sans-serif;
  }

  .voice-app aside {
    display: none;
  }

  .voice-app section {
    padding: 40px;
  }

  .voice-app header {
    text-align: center;
  }

  .voice-app h1 {
    font-size: 34px;
  }

  .voice-app header button {
    padding: 8px 16px;
    border: 1px solid var(--voice-border);
    border-radius: 999px;
    background: var(--voice-surface);
    color: var(--voice-ink);
    cursor: default;
  }

  .voice-grid {
    display: grid;
    grid-template-columns: 1.15fr 0.95fr 0.55fr;
    gap: 18px;
  }

  .voice-grid article {
    border: 1px solid var(--voice-border);
    border-radius: 26px;
    background: var(--voice-surface);
    padding: 24px;
  }

  .voice-large {
    min-height: 300px;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--voice-accent) 72%, var(--voice-surface)),
        color-mix(in srgb, var(--voice-accent-b) 68%, var(--voice-surface-strong))
      ) !important;
    color: color-mix(in srgb, var(--voice-bg) 88%, var(--voice-ink));
  }

  .voice-large strong {
    display: block;
    max-width: 13ch;
    margin-top: 100px;
    font-size: 32px;
  }

  .voice-large span {
    display: inline-block;
    margin-top: 16px;
    padding: 8px 14px;
    border: 1px solid color-mix(in srgb, var(--voice-bg) 28%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--voice-bg) 30%, transparent);
  }

  .voice-transcript {
    min-height: 300px;
  }

  .voice-transcript h2 {
    font-size: 26px;
  }

  .voice-number {
    display: grid;
    place-items: center;
    text-align: center;
    background: color-mix(in srgb, var(--voice-accent) 14%, var(--voice-surface)) !important;
  }

  .voice-number span {
    font-size: 46px;
  }

  .voice-fab {
    position: fixed;
    right: 52px;
    bottom: 42px;
    width: 72px;
    height: 72px;
    border: 1px solid color-mix(in srgb, var(--voice-accent) 40%, var(--voice-border));
    border-radius: 50%;
    background: color-mix(in srgb, var(--voice-accent) 42%, var(--voice-surface));
    color: var(--voice-ink);
    box-shadow: none;
    cursor: default;
  }
</style>



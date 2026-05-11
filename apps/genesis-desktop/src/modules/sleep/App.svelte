<script lang="ts">
  const routine = ["Dim lights", "No caffeine after 2pm", "Stretch shoulders", "Smart alarm set"];
</script>

<main class="sleep-app module-root">
  <nav>
    <strong>Somna</strong>
    <span>Tonight</span>
    <span>Score</span>
    <span>Routine</span>
    <span>Trends</span>
  </nav>

  <header>
    <h1>Sleep score</h1>
    <b>82</b>
    <p>7h 42m last night</p>
  </header>

  <section>
    <article class="sleep-score">
      <div>
        82
        <small>score</small>
      </div>
    </article>
    <article class="sleep-trend">
      <h2>Weekly trend</h2>
      {#each [62, 74, 58, 82, 69, 77, 71] as h}
        <span style={`--h:${h}%`}></span>
      {/each}
    </article>
    <article class="sleep-routine">
      <h2>Bedtime routine</h2>
      {#each routine as step}
        <p>{step}<b>Done</b></p>
      {/each}
    </article>
    <article class="sleep-alarm">
      <h2>Smart alarm</h2>
      <strong>06:35</strong>
      <small>Wake window 06:15 - 06:45</small>
    </article>
  </section>
</main>

<style>
  .sleep-app {
    --sleep-bg: var(--background);
    --sleep-surface: color-mix(in srgb, var(--surface) 94%, var(--background));
    --sleep-surface-strong: color-mix(in srgb, var(--surface) 86%, var(--background));
    --sleep-ink: var(--foreground);
    --sleep-muted: var(--muted);
    --sleep-border: var(--border);
    --sleep-accent: var(--primary);
    --sleep-accent-soft: color-mix(in srgb, var(--primary) 58%, var(--accent));
    --sleep-track: color-mix(in srgb, var(--border) 84%, var(--background));
    min-height: 100%;
    padding: 36px;
    background: var(--sleep-bg);
    color: var(--sleep-ink);
    font-family: "Satoshi", "Manrope", sans-serif;
  }

  .sleep-app nav {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .sleep-app nav strong {
    margin-right: auto;
  }

  .sleep-app nav span {
    padding: 12px 22px;
    border: 1px solid var(--sleep-border);
    border-radius: 999px;
    background: var(--sleep-surface-strong);
  }

  .sleep-app nav span:first-of-type {
    background: var(--sleep-ink);
    color: var(--sleep-bg);
    border-color: color-mix(in srgb, var(--sleep-ink) 68%, var(--sleep-border));
  }

  .sleep-app header {
    display: grid;
    grid-template-columns: 1fr auto 240px;
    align-items: end;
    margin: 50px 0;
  }

  .sleep-app h1 {
    font-size: 50px;
  }

  .sleep-app header b {
    font-size: 72px;
    color: var(--sleep-accent);
  }

  .sleep-app section {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1fr 1fr;
    gap: 18px;
  }

  .sleep-app article {
    padding: 26px;
    border: 1px solid var(--sleep-border);
    border-radius: 28px;
    background: var(--sleep-surface);
  }

  .sleep-score div {
    display: grid;
    place-items: center;
    width: 250px;
    height: 250px;
    margin: auto;
    border-radius: 50%;
    background: conic-gradient(var(--sleep-accent) 82%, var(--sleep-track) 0);
    box-shadow: inset 0 0 0 48px var(--sleep-surface);
    font-size: 64px;
  }

  .sleep-score small {
    font-size: 14px;
  }

  .sleep-trend {
    display: flex;
    align-items: end;
    gap: 16px;
  }

  .sleep-trend h2 {
    align-self: start;
    margin-right: auto;
  }

  .sleep-trend span {
    width: 28px;
    height: var(--h);
    border-radius: 999px;
    background: linear-gradient(var(--sleep-accent), var(--sleep-accent-soft));
  }

  .sleep-routine p {
    display: flex;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid var(--sleep-border);
  }

  .sleep-routine b {
    color: var(--sleep-accent);
  }

  .sleep-alarm strong {
    display: block;
    margin: 40px 0 10px;
    font-size: 58px;
    font-family: "JetBrains Mono", monospace;
  }
</style>



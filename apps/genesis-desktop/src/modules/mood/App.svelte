<script lang="ts">
  const moods = ["Focused", "Calm", "Tired", "Restless", "Creative"];
</script>

<main class="mood-app module-root">
  <section>
    <header>
      <span></span>
      <p>
        Welcome, Maya
        <small>Your mood dashboard</small>
      </p>
    </header>

    <div class="mood-top">
      <article class="mood-profile">
        <i>MS</i>
        <h2>Maya Simmons</h2>
        <footer><b>11</b><b>56</b><b>12</b></footer>
      </article>
      <article class="mood-red">
        <h2>Great Days</h2>
        <b>83%</b>
      </article>
      <article class="mood-blue">
        <h2>Calm Days</h2>
        <b>56%</b>
      </article>
      <article class="mood-tools">
        Connected Apps
        <b>3 active connections</b>
      </article>
    </div>

    <article class="mood-line">
      <h2>Focusing</h2>
      <svg viewBox="0 0 700 220">
        <path d="M20 120 C90 80 100 170 170 120 S250 60 320 125 420 190 500 125 620 80 680 135"></path>
        <path d="M20 100 C110 150 170 90 240 150 S350 90 430 95 540 150 680 105"></path>
      </svg>
    </article>
  </section>

  <aside>
    <h2>Today's Check-ins</h2>
    {#each moods as mood}
      <p><span>08:{10 + moods.indexOf(mood) * 7}</span><b>{mood}</b><button>Open</button></p>
    {/each}
    <h2>Mood Patterns</h2>
    {#each moods as mood, i}
      <div>{mood}<i style={`--w:${55 + i * 7}%`}></i><b>{55 + i * 7}%</b></div>
    {/each}
  </aside>
</main>

<style>
  .mood-app {
    --mood-bg: var(--background);
    --mood-surface: color-mix(in srgb, var(--surface) 96%, var(--background));
    --mood-surface-strong: color-mix(in srgb, var(--surface) 84%, var(--background));
    --mood-ink: var(--foreground);
    --mood-muted: var(--muted);
    --mood-border: var(--border);
    --mood-accent-a: var(--primary);
    --mood-accent-b: var(--accent);
    --mood-accent-warm: color-mix(in srgb, var(--primary) 62%, var(--background));
    --mood-accent-cool: color-mix(in srgb, var(--accent) 58%, var(--background));
    min-height: 100%;
    display: grid;
    grid-template-columns: 2fr 0.9fr;
    background: var(--mood-bg);
    color: var(--mood-ink);
    font-family: "Lato", sans-serif;
  }

  .mood-app section {
    padding: 38px;
  }

  .mood-app header {
    display: flex;
    gap: 18px;
  }

  .mood-app header span {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--mood-accent-a), var(--mood-accent-b));
  }

  .mood-top {
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 18px;
    margin-top: 34px;
  }

  .mood-top article,
  .mood-line,
  .mood-app aside {
    border: 1px solid var(--mood-border);
    border-radius: 24px;
    background: var(--mood-surface);
    padding: 24px;
  }

  .mood-profile {
    grid-row: span 2;
    text-align: center;
  }

  .mood-profile i {
    display: grid;
    place-items: center;
    width: 118px;
    height: 118px;
    margin: 30px auto;
    border-radius: 50%;
    background: var(--mood-accent-warm);
    color: color-mix(in srgb, var(--mood-bg) 86%, var(--mood-ink));
    font-style: normal;
    font-size: 28px;
  }

  .mood-profile footer {
    display: flex;
    justify-content: center;
    gap: 28px;
  }

  .mood-red {
    background: linear-gradient(
      135deg,
      var(--mood-surface),
      color-mix(in srgb, var(--mood-accent-warm) 82%, var(--mood-surface)),
      color-mix(in srgb, var(--mood-accent-a) 48%, var(--mood-surface))
    ) !important;
  }

  .mood-blue {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--mood-surface) 92%, var(--background)),
      color-mix(in srgb, var(--mood-accent-cool) 74%, var(--mood-surface)),
      color-mix(in srgb, var(--mood-accent-b) 40%, var(--mood-surface))
    ) !important;
  }

  .mood-red b,
  .mood-blue b {
    font-size: 48px;
  }

  .mood-tools {
    grid-column: span 2;
    background: var(--mood-surface-strong) !important;
  }

  .mood-line {
    margin-top: 26px;
  }

  .mood-line svg {
    width: 100%;
    height: 240px;
  }

  .mood-line path {
    fill: none;
    stroke: color-mix(in srgb, var(--mood-accent-a) 78%, var(--foreground));
    stroke-width: 5;
  }

  .mood-line path + path {
    stroke: color-mix(in srgb, var(--mood-accent-b) 68%, var(--foreground));
  }

  .mood-app aside {
    border-radius: 0;
  }

  .mood-app aside p {
    display: grid;
    grid-template-columns: 60px 1fr 60px;
    gap: 12px;
    padding: 16px 0;
    border-bottom: 1px solid var(--mood-border);
  }

  .mood-app aside button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: default;
  }

  .mood-app aside div {
    display: grid;
    grid-template-columns: 120px 1fr 44px;
    gap: 12px;
    align-items: center;
  }

  .mood-app aside i {
    height: 6px;
    border-radius: 999px;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--mood-accent-b) 74%, var(--foreground)) var(--w),
        color-mix(in srgb, var(--mood-border) 76%, transparent) 0
      );
  }
</style>



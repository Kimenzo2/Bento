<script lang="ts">
  const drinks = ["07:20 250ml", "09:45 500ml", "12:05 250ml", "15:40 150ml"];
</script>

<main class="water-app module-root">
  <h1>Hydration</h1>
  <section>
    <article class="water-ring">
      <div>
        0.7L
        <small>of 2.4L</small>
      </div>
    </article>
    <article class="water-add">
      <h2>Quick add</h2>
      {#each ["150ml", "250ml", "500ml", "Custom"] as amount}
        <button>{amount}</button>
      {/each}
    </article>
    <article class="water-log">
      <h2>Daily timeline</h2>
      {#each drinks as d}
        <p>{d}</p>
      {/each}
    </article>
    <article class="water-stats">
      <h2>Stats</h2>
      <p>Streak <b>12 days</b></p>
      <p>Weekly average <b>1.9L</b></p>
      <p>Best day <b>2.8L</b></p>
    </article>
    <article class="water-reminders">
      <h2>Reminder settings</h2>
      <span>Every 90 minutes</span>
      <i></i>
    </article>
  </section>
</main>

<style>
  .water-app {
    --water-bg: var(--background);
    --water-surface: color-mix(in srgb, var(--surface) 94%, var(--background));
    --water-surface-strong: color-mix(in srgb, var(--surface) 84%, var(--background));
    --water-ink: var(--foreground);
    --water-muted: var(--muted);
    --water-border: var(--border);
    --water-accent: var(--primary);
    --water-track: color-mix(in srgb, var(--border) 88%, var(--background));
    --water-soft-ink: color-mix(in srgb, var(--foreground) 82%, var(--background));
    min-height: 100%;
    padding: 40px;
    background: var(--water-bg);
    color: var(--water-ink);
    font-family: "Space Grotesk", sans-serif;
  }

  .water-app h1 {
    font-size: 48px;
  }

  .water-app section {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr 0.8fr 1fr;
    gap: 18px;
  }

  .water-app article {
    border: 1px solid var(--water-border);
    border-radius: 28px;
    background: var(--water-surface);
    padding: 28px;
  }

  .water-ring {
    display: grid;
    place-items: center;
    grid-row: span 2;
  }

  .water-ring div {
    display: grid;
    place-items: center;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: conic-gradient(var(--water-accent) 29%, var(--water-track) 0);
    box-shadow: inset 0 0 0 56px var(--water-surface);
    font-size: 58px;
  }

  .water-ring small {
    font-size: 16px;
    color: var(--water-muted);
  }

  .water-add button {
    display: block;
    width: 100%;
    margin: 12px 0;
    padding: 16px;
    border: 1px solid color-mix(in srgb, var(--water-accent) 48%, var(--water-border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--water-accent) 18%, var(--water-surface));
    color: var(--water-soft-ink);
    cursor: default;
  }

  .water-log p,
  .water-stats p {
    display: flex;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid var(--water-border);
  }

  .water-reminders {
    grid-column: span 3;
  }

  .water-reminders i {
    display: block;
    height: 18px;
    margin-top: 38px;
    border-radius: 999px;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--water-accent) 72%, var(--water-surface)) 62%,
        color-mix(in srgb, var(--water-border) 72%, transparent) 0
      );
  }
</style>



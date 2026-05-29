<!--
  PremiumRing — dual-mode radial progress ring.

  MODE A — Segmented dots (hydration, habits):
    Pass `value` (0–100). Renders layerchart PieChart with 60 dot segments.
    <PremiumRing value={hydrationPct} count={60} size={250} label="580 / 2000 ml" />

  MODE B — Smooth arc (journal calories, macros):
    Pass `segments` array. Renders a pure SVG donut with center text.
    No layerchart dependency — cleaner for small rings.
    <PremiumRing
      segments={[{ value: journalProgress, color: "white", label: "Calories" }]}
      size={156} thickness={12}
      centerValue="1840" centerLabel="kcal" centerNote="/ 2200"
    />

  Layerchart 1.x compatibility:
    tooltipContext={false} is NOT valid (expects Writable store or undefined).
    Removed. Tooltip is suppressed by not providing a tooltip prop instead.
    Named slot content MUST use <svelte:fragment slot="aboveMarks">, NOT {#snippet}.
-->
<script lang="ts">
  import { PieChart, Text } from 'layerchart';

  // ── Segment definition (arc mode) ────────────────────────────────────────
  interface Segment {
    value: number;    // 0–100 progress
    color: string;    // CSS colour for the filled arc
    label?: string;   // unused currently, reserved for legend
  }

  // ── Props ─────────────────────────────────────────────────────────────────
  let {
    // ── Shared ──────────────────────────────────────────────────────────────
    size        = 260,

    // ── MODE A: Segmented dots ───────────────────────────────────────────────
    // Pass `value` to activate this mode.
    value        = $bindable<number | undefined>(undefined),
    count        = 60,
    label        = "",            // small text beneath the number in the SVG
    activeColor  = "var(--color-success, #52b788)",
    trackColor   = "color-mix(in lch, currentColor 10%, transparent)",

    // ── MODE B: Smooth arc + center text ─────────────────────────────────────
    // Pass `segments` to activate this mode.
    segments    = undefined as Segment[] | undefined,
    thickness   = 14,            // stroke width in px
    centerValue = undefined as string | undefined,   // large text in center
    centerLabel = undefined as string | undefined,   // small label above value
    centerNote  = undefined as string | undefined,   // tiny note below value
  }: {
    size?:        number;
    value?:       number;
    count?:       number;
    label?:       string;
    activeColor?: string;
    trackColor?:  string;
    segments?:    Segment[];
    thickness?:   number;
    centerValue?: string;
    centerLabel?: string;
    centerNote?:  string;
  } = $props();

  // ── Mode detection ────────────────────────────────────────────────────────
  const isArcMode = $derived(segments !== undefined);

  // ── MODE A — segmented dots data ──────────────────────────────────────────
  const pct = $derived(Math.min(100, Math.max(0, value ?? 0)));

  const dotsData = $derived(
    Array.from({ length: count }, (_, i) => ({
      key:   i + 1,
      value: 1,
      color: (i / count) * 100 < pct ? activeColor : trackColor,
    }))
  );

  // ── MODE B — SVG arc geometry ─────────────────────────────────────────────
  // We draw on a square canvas of `size × size`. The arc ring sits centred.
  const cx      = $derived(size / 2);
  const cy      = $derived(size / 2);
  const radius  = $derived(cx - thickness / 2 - 2);   // 2px safety margin
  const circum  = $derived(2 * Math.PI * radius);

  // Build per-segment path data from the `segments` array.
  // Each segment is a portion of the ring based on its `value` (0–100).
  // Multiple segments stack sequentially (for stacked donut usage).
  const arcSegs = $derived(
    (segments ?? []).map((seg) => {
      const filled  = (Math.min(100, Math.max(0, seg.value)) / 100) * circum;
      // dasharray: filled arc length, then gap to complete the circle
      const dash    = `${filled.toFixed(2)} ${(circum - filled).toFixed(2)}`;
      // Start at 12 o'clock (-90°). strokeDashoffset rotates the arc origin.
      const offset  = (circum * 0.25).toFixed(2);  // quarter-turn = top
      return { ...seg, dash, offset };
    })
  );
</script>

{#if isArcMode}
  <!-- ══════════════ MODE B — Pure SVG arc ring ══════════════ -->
  <div class="pr-arc-wrap" style="width:{size}px;height:{size}px">
    <svg
      width={size}
      height={size}
      viewBox="0 0 {size} {size}"
      aria-hidden="true"
      class="pr-arc-svg"
    >
      <!-- Track (background ring) -->
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="color-mix(in srgb, currentColor 10%, transparent)"
        stroke-width={thickness}
        stroke-linecap="round"
      />

      <!-- Filled arc(s) -->
      {#each arcSegs as seg}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={seg.color}
          stroke-width={thickness}
          stroke-linecap="round"
          stroke-dasharray={seg.dash}
          stroke-dashoffset={seg.offset}
          transform="rotate(-90 {cx} {cy})"
        />
      {/each}

      <!-- Center text group -->
      {#if centerLabel || centerValue || centerNote}
        <g transform="translate({cx},{cy})">
          {#if centerLabel}
            <text
              text-anchor="middle"
              dominant-baseline="middle"
              dy={centerValue ? "-1.6em" : "0"}
              class="pr-arc-label"
            >{centerLabel}</text>
          {/if}

          {#if centerValue}
            <text
              text-anchor="middle"
              dominant-baseline="middle"
              dy={centerLabel ? "0" : (centerNote ? "-0.6em" : "0")}
              class="pr-arc-value"
            >{centerValue}</text>
          {/if}

          {#if centerNote}
            <text
              text-anchor="middle"
              dominant-baseline="middle"
              dy={centerValue ? "1.4em" : "0"}
              class="pr-arc-note"
            >{centerNote}</text>
          {/if}
        </g>
      {/if}
    </svg>
  </div>

{:else}
  <!-- ══════════════ MODE A — Layerchart segmented dots ══════════════ -->
  <!--
    tooltipContext is intentionally NOT passed.
    layerchart 1.x types it as Writable<{...}> — passing false or null
    is a TypeScript error. Omitting it leaves tooltips disabled by default
    when no Tooltip component is provided as a child slot.
  -->
  <div class="pr-dots-wrap" style="--pr-size:{size}px">
    <PieChart
      data={dotsData}
      key="key"
      value="value"
      c="color"
      innerRadius={-20}
      cornerRadius={4}
      padAngle={0.02}
      height={size}
      props={{ tooltip: { context: { disabled: true } as any } }}
    >
      <!--
        Svelte 4 named slot syntax. Do NOT use {#snippet} — layerchart@1.x
        ignores Svelte 5 snippets entirely (they are NOT the same as slots).
      -->
      <svelte:fragment slot="aboveMarks">
        {#if value !== undefined}
          <Text
            value={Math.round(pct)}
            textAnchor="middle"
            verticalAnchor="middle"
            dy={label ? 4 : 16}
            class="pr-dots-value tabular-nums fill-foreground"
          />
        {/if}
        {#if label}
          <Text
            value={label}
            textAnchor="middle"
            verticalAnchor="middle"
            dy={value !== undefined ? 28 : 16}
            class="pr-dots-label fill-muted-foreground"
          />
        {/if}
      </svelte:fragment>
    </PieChart>
  </div>
{/if}

<style>
  /* ── Arc mode ──────────────────────────────────────────────────────── */
  .pr-arc-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .pr-arc-svg {
    display: block;
    overflow: visible;
  }

  .pr-arc-label {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    fill: var(--muted-foreground, currentColor);
    opacity: 0.7;
  }

  .pr-arc-value {
    font-size: 1.55rem;
    font-weight: 700;
    fill: var(--foreground, currentColor);
    font-variant-numeric: tabular-nums;
  }

  .pr-arc-note {
    font-size: 0.68rem;
    font-weight: 500;
    fill: var(--muted-foreground, currentColor);
    opacity: 0.65;
  }

  /* ── Dots mode ─────────────────────────────────────────────────────── */
  .pr-dots-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: var(--pr-size, 260px);
    margin-inline: auto;
  }

  .pr-dots-wrap :global(.pr-dots-value) {
    font-size: 3.5rem;
    font-weight: 700;
    line-height: 1;
  }

  .pr-dots-wrap :global(.pr-dots-label) {
    font-size: 0.85rem;
    font-weight: 500;
  }
</style>

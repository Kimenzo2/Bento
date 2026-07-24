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
    ariaLabel   = "",             // accessible label for the ring (screen readers)

    // ── MODE A: Segmented dots ───────────────────────────────────────────────
    // Pass `value` to activate this mode.
    value        = $bindable<number | undefined>(undefined),
    count        = 60,
    label        = "",            // small text beneath the number in the SVG
    activeColor  = "var(--color-success, oklch(0.706 0.118 160.888))",
    trackColor   = "color-mix(in lch, currentColor 10%, transparent)",

    // ── MODE B: Smooth arc + center text ─────────────────────────────────────
    // Pass `segments` to activate this mode.
    segments    = undefined as Segment[] | undefined,
    thickness   = 14,            // stroke width in px
    gap         = 4,             // gap between segments (for future multi-segment layout)
    centerValue = undefined as string | undefined,   // large text in center
    centerLabel = undefined as string | undefined,   // small label above value
    centerNote  = undefined as string | undefined,   // tiny note below value
  }: {
    size?:        number;
    ariaLabel?:   string;
    value?:       number;
    count?:       number;
    label?:       string;
    activeColor?: string;
    trackColor?:  string;
    segments?:    Segment[];
    thickness?:   number;
    gap?:         number;
    centerValue?: string;
    centerLabel?: string;
    centerNote?:  string;
  } = $props();

  // ── Mode detection ────────────────────────────────────────────────────────
  const isArcMode = $derived(segments !== undefined);

  // ── Accessible label ──────────────────────────────────────────────────────
  // In arc mode, build a description from center text if no explicit ariaLabel.
  const computedAriaLabel = $derived.by(() => {
    if (ariaLabel) return ariaLabel;
    if (isArcMode) {
      const parts = [centerLabel, centerValue, centerNote].filter(Boolean);
      return parts.length ? parts.join(' ') : 'Progress ring';
    }
    // dots mode
    return label ? `${Math.round(pct)}% ${label}` : `${Math.round(pct)}% progress`;
  });

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
  const cx      = $derived(size / 2);
  const cy      = $derived(size / 2);
  const radius  = $derived(cx - thickness / 2 - 2);
  const circum  = $derived(2 * Math.PI * radius);

  // For stacked donut: each segment occupies its value% of the ring,
  // and starts where the previous one ended. Gap is subtracted from each.
  const arcSegs = $derived.by(() => {
    const segs = segments ?? [];
    const total = segs.reduce((s, seg) => s + Math.min(100, Math.max(0, seg.value)), 0);
    const scale = total > 100 ? 100 / total : 1;
    let consumed = 0; // degrees already used, starting from top (0 = 12 o'clock)

    return segs.map((seg) => {
      const pctVal  = Math.min(100, Math.max(0, seg.value)) * scale;
      const gapAngle = (gap / circum) * 360;
      const arcLen  = Math.max(0, (pctVal / 100) * circum - gap);
      const dash    = `${arcLen.toFixed(2)} ${(circum - arcLen).toFixed(2)}`;
      // dashoffset shifts start position: full circum = 0°, quarter back = top
      const offsetArc = circum - (consumed / 360) * circum + circum * 0.25;
      consumed += pctVal / 100 * 360 + gapAngle;
      return { ...seg, dash, offset: offsetArc.toFixed(2) };
    });
  });
</script>

{#if isArcMode}
  <!-- ══════════════ MODE B — Pure SVG arc ring ══════════════ -->
  <div class="pr-arc-wrap" style="width:{size}px;height:{size}px">
    <svg
      width={size}
      height={size}
      viewBox="0 0 {size} {size}"
      role="img"
      aria-label={computedAriaLabel}
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
              class="number number-metric pr-arc-label"
            >{centerLabel}</text>
          {/if}

          {#if centerValue}
            <text
              text-anchor="middle"
              dominant-baseline="middle"
              dy={centerLabel ? "0" : (centerNote ? "-0.6em" : "0")}
              class="number number-hero pr-arc-value"
            >{centerValue}</text>
          {/if}

          {#if centerNote}
            <text
              text-anchor="middle"
              dominant-baseline="middle"
              dy={centerValue ? "1.4em" : "0"}
              class="number number-stat pr-arc-note"
            >{centerNote}</text>
          {/if}
        </g>
      {/if}
    </svg>
  </div>

{:else}
  <!-- ══════════════ MODE A — Layerchart segmented dots ══════════════ -->
  <!--      -->
  <div class="pr-dots-wrap" style="--pr-size:{size}px" role="img" aria-label={computedAriaLabel}>
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
      -->
      {#snippet aboveMarks()}
        {#if value !== undefined}
          <Text
            value={Math.round(pct)}
            textAnchor="middle"
            verticalAnchor="middle"
            dy={label ? 4 : 16}
            class="number number-hero number-semibold pr-dots-value fill-foreground"
          />
        {/if}
        {#if label}
          <Text
            value={label}
            textAnchor="middle"
            verticalAnchor="middle"
            dy={value !== undefined ? 28 : 16}
            class="number number-metric pr-dots-label fill-muted-foreground"
          />
        {/if}
      {/snippet}
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

  /* ── Screen reader only ─────────────────────────────────────────────── */
  .pr-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>

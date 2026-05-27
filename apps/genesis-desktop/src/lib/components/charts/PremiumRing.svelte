<script lang="ts">
  type RingSegment = {
    value: number;
    color: string;
    label?: string;
  };

  let {
    segments = [] as RingSegment[],
    size = 160,
    thickness = 12,
    gap = 8,
    trackColor = "color-mix(in srgb, var(--border, rgba(255,255,255,0.16)) 84%, transparent)",
    centerValue = "",
    centerLabel = "",
    centerNote = "",
    showLegend = false,
    class: className = "",
  } = $props<{
    segments?: RingSegment[];
    size?: number;
    thickness?: number;
    gap?: number;
    trackColor?: string;
    centerValue?: string;
    centerLabel?: string;
    centerNote?: string;
    showLegend?: boolean;
    class?: string;
  }>();

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const totalMax = 100;
  const ringInsets = 18;

  type NormalizedRingSegment = RingSegment & { order: number };

  const normalizedSegments = $derived.by((): NormalizedRingSegment[] =>
    segments
      .filter((segment: RingSegment) => segment.value > 0)
      .map((segment: RingSegment, index: number) => ({
        ...segment,
        value: clamp(segment.value, 0, totalMax),
        order: index,
      }))
  );

  const ringLayers = $derived.by(() => {
    const baseRadius = Math.max((size / 2) - ringInsets - thickness / 2, 12);
    return normalizedSegments.map((segment: NormalizedRingSegment, index: number) => {
      const radius = Math.max(baseRadius - index * (thickness + gap), 10);
      const circumference = 2 * Math.PI * radius;
      const sweep = circumference * (segment.value / totalMax);

      return {
        ...segment,
        radius,
        circumference,
        sweep,
      };
    });
  });
</script>

<div class={`premium-ring ${className}`.trim()}>
  <svg class="premium-ring__svg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    {#each ringLayers as ring}
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={ring.radius}
          fill="none"
          stroke={trackColor}
          stroke-width={thickness}
          opacity="0.55"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={ring.radius}
          fill="none"
          stroke={ring.color}
          stroke-width={thickness}
          stroke-linecap="round"
          stroke-dasharray={`${ring.sweep} ${ring.circumference - ring.sweep}`}
          stroke-dashoffset={0}
          style={`transition: stroke-dasharray 550ms cubic-bezier(0.16, 1, 0.3, 1);`}
        />
      </g>
    {/each}
  </svg>

  <div class="premium-ring__center">
    {#if centerLabel}
      <span class="premium-ring__label">{centerLabel}</span>
    {/if}
    {#if centerValue}
      <strong class="premium-ring__value">{centerValue}</strong>
    {/if}
    {#if centerNote}
      <small class="premium-ring__note">{centerNote}</small>
    {/if}
  </div>

  {#if showLegend && normalizedSegments.length > 1}
    <div class="premium-ring__legend" aria-hidden="true">
      {#each normalizedSegments as segment}
        <span>
          <i style={`background:${segment.color}`}></i>
          {segment.label}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .premium-ring {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    isolation: isolate;
  }

  .premium-ring::before {
    content: "";
    position: absolute;
    inset: 10%;
    border-radius: 50%;
    background: transparent;
    z-index: 0;
    pointer-events: none;
  }

  .premium-ring__svg {
    position: relative;
    width: 100%;
    height: 100%;
    z-index: 1;
    overflow: visible;
  }

  .premium-ring__center {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    gap: 0.22rem;
    padding: 0.6rem 0.75rem;
    text-align: center;
    z-index: 2;
    pointer-events: none;
  }

  .premium-ring__label {
    display: block;
    margin-bottom: 0.28rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 0.68rem;
    color: color-mix(in srgb, currentColor 54%, transparent);
  }

  .premium-ring__value {
    display: block;
    font-size: clamp(1.28rem, 2vw, 1.82rem);
    line-height: 0.95;
    font-weight: 700;
    letter-spacing: -0.05em;
    color: var(--foreground, #fff);
    text-wrap: balance;
  }

  .premium-ring__note {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.82rem;
    color: color-mix(in srgb, currentColor 52%, transparent);
  }

  .premium-ring__legend {
    position: absolute;
    left: 50%;
    bottom: -0.15rem;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    white-space: nowrap;
    z-index: 3;
    pointer-events: none;
    font-size: 0.72rem;
    color: color-mix(in srgb, currentColor 58%, transparent);
  }

  .premium-ring__legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .premium-ring__legend i {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 999px;
    box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 14%, transparent);
  }
</style>

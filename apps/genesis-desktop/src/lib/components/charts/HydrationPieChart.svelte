<script lang="ts">
  interface Props {
    /** Current percentage (0-100) */
    percentage?: number;
    /** Number of segments in the ring */
    segments?: number;
    /** Height/width of the chart */
    height?: number;
  }

  let { 
    percentage = 29, 
    segments = 60, 
    height = 200 
  }: Props = $props();

  // Clamp percentage between 0 and 100
  let clampedPercentage = $derived(Math.max(0, Math.min(100, percentage)));
  
  // Calculate SVG parameters
  const size = $derived(height);
  const strokeWidth = $derived(Math.max(14, height / 12));
  const radius = $derived((size - strokeWidth - 8) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const center = $derived(size / 2);
  
  // Calculate the filled arc length
  const filledLength = $derived((clampedPercentage / 100) * circumference);
</script>

<div class="hydration-pie-chart" style="width: {size}px; height: {size}px;">
  <svg 
    viewBox="0 0 {size} {size}" 
    class="hydration-pie-svg"
  >
    <!-- Background track -->
    <circle
      cx={center}
      cy={center}
      r={radius}
      fill="none"
      stroke="hsl(var(--muted) / 0.2)"
      stroke-width={strokeWidth}
    />
    
    <!-- Filled progress arc -->
    <circle
      cx={center}
      cy={center}
      r={radius}
      fill="none"
      stroke="hsl(var(--primary))"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-dasharray="{filledLength} {circumference - filledLength}"
      stroke-dashoffset={circumference / 4}
      class="hydration-pie-progress"
    />
  </svg>
  
  <div class="hydration-pie-center">
    <span class="hydration-pie-value">{Math.round(clampedPercentage)}%</span>
  </div>
</div>

<style>
  .hydration-pie-chart {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hydration-pie-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .hydration-pie-progress {
    transition: stroke-dasharray 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .hydration-pie-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .hydration-pie-value {
    font-size: 2rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--primary));
  }
</style>

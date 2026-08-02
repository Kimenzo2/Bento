<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

<script lang="ts">
  import { PieChart, Text } from 'layerchart';
  import { Spring } from 'svelte/motion';

  interface Props {
    /** Current percentage (0-100) */
    percentage?: number;
    /** Number of segments in the ring */
    segments?: number;
    /** Height of the chart */
    height?: number;
    /** Accessible label for screen readers */
    ariaLabel?: string;
  }

  let { 
    percentage = 29, 
    segments = 60, 
    height = 200,
    ariaLabel = ""
  }: Props = $props();

  let springValue = new Spring(0);

  // Update spring when percentage changes
  $effect(() => {
    springValue.target = percentage;
  });

  let currentValue = $derived(springValue.current ?? percentage);

  let data = $derived(
    Array.from({ length: segments }, (_, i) => {
      const segmentPercentage = (i / segments) * 100;
      const isFilled = segmentPercentage < currentValue;
      return {
        key: String(i + 1),
        value: 1,
        color: isFilled
          ? 'hsl(var(--primary))'
          : 'hsl(var(--muted) / 0.15)'
      };
    })
  );

  const computedAriaLabel = $derived(
    ariaLabel || `Hydration progress: ${Math.round(percentage)}%`
  );
</script>

<div class="hydration-pie-wrapper" role="img" aria-label={computedAriaLabel}>
  <PieChart
    {data}
    key="key"
    value="value"
    c="color"
    innerRadius={-20}
    cornerRadius={4}
    padAngle={0.02}
    {height}
  />
</div>

<style>
  .hydration-pie-wrapper {
    width: 100%;
    height: 100%;
    min-height: 180px;
  }

  .hydration-pie-wrapper :global(svg) {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
</style>

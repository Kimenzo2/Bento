<script lang="ts">
  let {
    size = 48,
  }: {
    size?: number;
  } = $props();
</script>

<!--
  Inline SVG logo — no external file dependency.
  Works identically in dev mode and production Tauri builds.
-->
<svg
  class="auth-logo"
  width={size}
  height={size}
  viewBox="0 0 48 48"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
  role="img"
>
  <!-- Bento box lid (top panel) -->
  <rect x="4" y="9" width="40" height="8" rx="3" fill="currentColor" opacity="0.3" />
  <!-- Bento box body compartments -->
  <rect x="4" y="20" width="18" height="19" rx="3" fill="currentColor" opacity="0.7" />
  <rect x="26" y="20" width="18" height="8" rx="3" fill="currentColor" opacity="0.5" />
  <rect x="26" y="31" width="18" height="8" rx="3" fill="currentColor" opacity="0.9" />
</svg>

<style>
  .auth-logo {
    display: block;
    object-fit: contain;
  }
</style>

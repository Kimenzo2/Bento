<script lang="ts">
  let {
    size = 48,
  }: {
    size?: number;
  } = $props();
</script>

<img
  class="auth-logo"
  src="/favicon.png"
  alt=""
  aria-hidden="true"
  width={size}
  height={size}
/>

<style>
  .auth-logo {
    display: block;
    object-fit: contain;
  }
</style>

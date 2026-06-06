<script lang="ts">
  import bentoIcon from "../../../assets/bento-icon.png";

  let {
    size = 48,
  }: {
    size?: number;
  } = $props();
</script>

<!--
  Real Bento icon — transparent PNG, symbol only (no background).
  The red/orange connectors read clearly on both dark and light surfaces.
-->
<img
  class="auth-logo"
  src={bentoIcon}
  width={size}
  height={size}
  alt="Bento"
  aria-hidden="true"
  draggable="false"
/>

<style>
  .auth-logo {
    display: block;
    object-fit: contain;
  }
</style>

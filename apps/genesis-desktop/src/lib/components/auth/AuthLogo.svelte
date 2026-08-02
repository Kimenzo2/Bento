<!-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER. -->

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

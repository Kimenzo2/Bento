<script lang="ts">
  import type { Snippet } from "svelte";
  import AppTopbar from "$lib/components/AppTopbar.svelte";
  import ShellSidebar from "$lib/components/ShellSidebar.svelte";
  import type { PageKey } from "$lib/router/routes";

  let {
    page,
    children,
  }: {
    page: PageKey;
    children?: Snippet;
  } = $props();
</script>

<div class="desktop-workspace">
  <ShellSidebar currentPage={page} />
  <div class="desktop-workspace__content">
    <AppTopbar currentPage={page} />

    <main class="desktop-workspace__main">
      {@render children?.()}
    </main>
  </div>
</div>

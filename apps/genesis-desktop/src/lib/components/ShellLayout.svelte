<script lang="ts">
  import type { Snippet } from "svelte";
  import AppTopbar from "$lib/components/AppTopbar.svelte";
  import ShellSidebar from "$lib/components/ShellSidebar.svelte";
  import type { PageKey } from "$lib/router/routes";

  let {
    page,
    activeAppId,
    title,
    subtitle,
    children,
  }: {
    page: PageKey;
    activeAppId?: string;
    title?: string;
    subtitle?: string;
    children?: Snippet;
  } = $props();

</script>

<div class:desktop-workspace--mini-app={Boolean(activeAppId)} class="desktop-workspace">
  <ShellSidebar currentPage={page} {activeAppId} />
  <div class="desktop-workspace__content">
    <AppTopbar currentPage={page} {title} {subtitle} />

    <main class="desktop-workspace__main">
      {@render children?.()}
    </main>
  </div>
</div>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly, scale } from "svelte/transition";
  import AppTopbar from "$lib/components/AppTopbar.svelte";
  import ShellSidebar from "$lib/components/ShellSidebar.svelte";
  import FeedbackModal from "$lib/components/FeedbackModal.svelte";
  import type { PageKey } from "$lib/router/routes";
  import { workspaceStore } from "$lib/stores/workspace.store";

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

  // Pages that NEVER show ShellSidebar — enforced here as the single source of truth.
  // Tab mode, direct navigation, deep-links — nothing bypasses this set.
  const NO_SIDEBAR_PAGES = new Set<PageKey>(["dashboard", "settings", "pricing"]);

  // AppTopbar is suppressed on:
  // – pages in NO_SIDEBAR_PAGES that have their own layout (dashboard)
  // – mini-app mode → activeAppId is set; the single-row grid requires exactly
  //                   one child in .desktop-workspace__content, and the tab label
  //                   already identifies the module
  const showTopbar = $derived(!NO_SIDEBAR_PAGES.has(page) && !Boolean(activeAppId));

  const showSidebar = $derived(!NO_SIDEBAR_PAGES.has(page));

  // ── Feedback floating button state ──────────────────────────────────────
  let feedbackPickerOpen = $state(false);
  let feedbackType: 'bug' | 'feature' | null = $state(null);
  let feedbackModalOpen = $state(false);

  function openFeedbackPicker() {
    feedbackPickerOpen = true;
  }

  function closeFeedbackPicker() {
    feedbackPickerOpen = false;
  }

  function pickFeedback(type: 'bug' | 'feature') {
    feedbackPickerOpen = false;
    feedbackType = type;
    feedbackModalOpen = true;
  }

  function closeFeedback() {
    feedbackModalOpen = false;
    feedbackType = null;
  }

  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-feedback-picker]') && !target.closest('[data-feedback-btn]')) {
      feedbackPickerOpen = false;
    }
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && feedbackPickerOpen) {
      feedbackPickerOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleEscape} />

<div
  class:desktop-workspace--dashboard={page === "dashboard"}
  class:desktop-workspace--mini-app={Boolean(activeAppId)}
  class:desktop-workspace--sidebar-hidden={$workspaceStore.sidebarHidden}
  class:desktop-workspace--no-topbar={!showTopbar}
  class="desktop-workspace"
  style={`--desktop-sidebar-top:${$workspaceStore.sidebarTop}px`}
>
  {#if showSidebar}
    <ShellSidebar currentPage={page} {activeAppId} />
  {/if}

  <div class="desktop-workspace__content">
    {#if showTopbar}
      <AppTopbar currentPage={page} {title} {subtitle} />
    {/if}
    <main class="desktop-workspace__main">
      {@render children?.()}
    </main>
  </div>

  <!-- ── Floating feedback button ──────────────────────────────────────── -->
  <button
    data-feedback-btn
    class="feedback-float-btn"
    onclick={openFeedbackPicker}
    aria-label="Send Feedback"
    title="Send Feedback"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  </button>

  {#if feedbackPickerOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="feedback-overlay"
      onclick={closeFeedbackPicker}
      transition:fly={{ y: 0, duration: 0 }}
    ></div>

    <div
      data-feedback-picker
      class="feedback-picker"
      transition:scale={{ start: 0.9, duration: 150 }}
      onclick={handleOutsideClick}
    >
      <button class="feedback-picker__option" onclick={() => pickFeedback('bug')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m8 2 1.88 1.88"/>
          <path d="M14.12 3.88 16 2"/>
          <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
          <path d="M12 20v-9"/>
          <path d="M6.53 9C4.6 8.8 3 7.1 3 5"/>
          <path d="M17.47 9c1.93-.2 3.53-1.9 3.53-4"/>
          <path d="M6.53 13C4.6 12.8 3 11.1 3 9"/>
          <path d="M17.47 13c1.93-.2 3.53-1.9 3.53-4"/>
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
        </svg>
        <div class="feedback-picker__label">
          <span class="feedback-picker__title">Report a Bug</span>
          <span class="feedback-picker__sub">Something isn't working</span>
        </div>
      </button>
      <button class="feedback-picker__option" onclick={() => pickFeedback('feature')}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5C7.7 12.3 8.3 13 9 14"/>
          <path d="M9 14h6"/>
          <path d="M12 17v-3"/>
          <path d="M9 18h6"/>
          <path d="M10 22h4"/>
        </svg>
        <div class="feedback-picker__label">
          <span class="feedback-picker__title">Request a Feature</span>
          <span class="feedback-picker__sub">Suggest an improvement</span>
        </div>
      </button>
    </div>
  {/if}

  {#if feedbackModalOpen && feedbackType}
    <FeedbackModal
      type={feedbackType}
      activeModule={activeAppId ?? page}
      onclose={closeFeedback}
    />
  {/if}
</div>

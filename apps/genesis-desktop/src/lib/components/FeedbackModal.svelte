<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { toast } from "svelte-sonner";
  import { fade, scale } from "svelte/transition";

  let {
    type,
    onclose,
    activeModule,
  }: {
    type: 'bug' | 'feature';
    onclose: () => void;
    activeModule?: string;
  } = $props();

  // ── Form state ────────────────────────────────────────────────────────
  let title = $state('');
  let description = $state('');
  let severity = $state('medium');
  let category = $state('new_feature');
  let submitting = $state(false);
  let error = $state<string | null>(null);

  // ── OS / version info (captured once on mount) ────────────────────────
  let appVersion = $state('—');
  let osName = $state('—');
  let osVersion = $state('—');

  $effect(() => {
    // Try to get version from navigator user agent or meta
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) osName = 'Windows';
    else if (ua.includes('Mac OS')) osName = 'macOS';
    else if (ua.includes('Linux')) osName = 'Linux';
    else osName = 'Unknown';

    if (ua.includes('Windows NT 10.0')) osVersion = '10';
    else if (ua.includes('Windows NT 11.0')) osVersion = '11';
    else if (ua.includes('Mac OS X 10_15')) osVersion = '10.15 Catalina';
    else if (ua.includes('Mac OS X')) {
      const m = ua.match(/Mac OS X (\d+[_\d]+)/);
      osVersion = m ? m[1].replace(/_/g, '.') : 'Unknown';
    } else if (ua.includes('Linux')) {
      osVersion = navigator.platform || 'Unknown';
    } else osVersion = 'Unknown';

    appVersion = '0.1.0'; // Will be filled by Rust command server-side
  });

  // ── Validation ────────────────────────────────────────────────────────
  const canSubmit = $derived(
    title.trim().length >= 5 &&
    description.trim().length >= 20 &&
    !submitting
  );

  const labelMap: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    ui: 'UI & Design',
    performance: 'Performance',
    new_feature: 'New Feature',
    integration: 'Integration',
    other: 'Other',
  };

  // ── Submit handler ────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!canSubmit) return;
    submitting = true;
    error = null;

    try {
      await invoke<string>('submit_feedback', {
        params: {
          type: type,
          title: title.trim(),
          description: description.trim(),
          severity: type === 'bug' ? severity : null,
          category: type === 'feature' ? category : null,
          active_module: activeModule || '',
          screenshot: pastedImage ?? null,
        },
      });
      toast.success('Feedback submitted. Thank you!');
      onclose();
    } catch (e) {
      error = typeof e === 'string' ? e : 'Failed to submit feedback. Please try again.';
    } finally {
      submitting = false;
    }
  }

  // ── Screenshot paste / drag-drop ─────────────────────────────────────
  let pastedImage = $state<string | null>(null);   // base64 data URL
  let isDragOver = $state(false);

  function readImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => { pastedImage = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();           // don't paste raw binary into textarea
        const file = item.getAsFile();
        if (file) readImageFile(file);
        return;
      }
    }
    // Not an image — let the default text paste happen
  }

  function handleDragOver(e: DragEvent) {
    const hasImage = Array.from(e.dataTransfer?.items ?? []).some(i => i.type.startsWith('image/'));
    if (!hasImage) return;
    e.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() { isDragOver = false; }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    const file = Array.from(e.dataTransfer?.files ?? []).find(f => f.type.startsWith('image/'));
    if (file) readImageFile(file);
  }

  function removeImage() { pastedImage = null; }

  // ── Escape key ────────────────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !submitting) onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="feedback-modal-overlay"
  onclick={() => { if (!submitting) onclose(); }}
  transition:fade={{ duration: 150 }}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="feedback-modal"
    role="dialog"
    aria-modal="true"
    aria-label={type === 'bug' ? 'Report a Bug' : 'Request a Feature'}
    onclick={(e) => e.stopPropagation()}
    transition:scale={{ start: 0.95, duration: 200 }}
  >
    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <div class="feedback-modal__header">
      <div class="feedback-modal__header-left">
        {#if type === 'bug'}
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--destructive);">
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
          <h3>Report a Bug</h3>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5C7.7 12.3 8.3 13 9 14"/>
            <path d="M9 14h6"/>
            <path d="M12 17v-3"/>
            <path d="M9 18h6"/>
            <path d="M10 22h4"/>
          </svg>
          <h3>Request a Feature</h3>
        {/if}
      </div>
      <button class="feedback-modal__close" onclick={onclose} disabled={submitting} aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- ── Form body ──────────────────────────────────────────────────── -->
    <div class="feedback-modal__body">
      <!-- Title -->
      <div class="feedback-modal__field">
        <label for="feedback-title">
          {type === 'bug' ? "What's the issue?" : 'What would you like?'}
        </label>
        <input
          id="feedback-title"
          type="text"
          bind:value={title}
          placeholder={type === 'bug' ? 'Briefly describe the bug' : 'Briefly describe your request'}
          maxlength={200}
          disabled={submitting}
        />
      </div>

      <!-- Description -->
      <div class="feedback-modal__field">
        <label for="feedback-desc">
          Describe it in detail
          <span class="feedback-modal__label-hint">(or paste a screenshot)</span>
        </label>

        <!-- Drop zone wrapper — surrounds both textarea and preview -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="feedback-modal__drop-zone"
          class:feedback-modal__drop-zone--over={isDragOver}
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
        >
          <textarea
            id="feedback-desc"
            bind:value={description}
            placeholder={type === 'bug'
              ? 'What were you doing? What did you expect? What happened instead?'
              : 'What problem does this solve? How would it work?'
            }
            maxlength={5000}
            disabled={submitting}
            onpaste={handlePaste}
          ></textarea>

          <!-- Screenshot thumbnail — shown only when an image is attached -->
          {#if pastedImage}
            <div class="feedback-modal__screenshot">
              <img src={pastedImage} alt="Attached screenshot" />
              <button
                class="feedback-modal__screenshot-remove"
                type="button"
                onclick={removeImage}
                aria-label="Remove screenshot"
                title="Remove screenshot"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          {:else if isDragOver}
            <div class="feedback-modal__drop-hint">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Drop image here
            </div>
          {/if}
        </div>

        <div class="feedback-modal__char-count">
          {description.length}/5000
        </div>
      </div>

      <!-- Severity (bug only) -->
      {#if type === 'bug'}
        <div class="feedback-modal__field">
          <label>How severe is this?</label>
          <div class="feedback-modal__segmented">
            {#each ['critical', 'high', 'medium', 'low'] as s}
              <button
                class:feedback-modal__segment-active={severity === s}
                onclick={() => severity = s}
                disabled={submitting}
              >
                {labelMap[s]}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Category (feature only) -->
      {#if type === 'feature'}
        <div class="feedback-modal__field">
          <label>What area does this affect?</label>
          <div class="feedback-modal__segmented">
            {#each ['ui', 'performance', 'new_feature', 'integration', 'other'] as c}
              <button
                class:feedback-modal__segment-active={category === c}
                onclick={() => category = c}
                disabled={submitting}
              >
                {labelMap[c]}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Auto-captured info -->
      <div class="feedback-modal__info">
        <div class="feedback-modal__info-label">We'll also include:</div>
        <div class="feedback-modal__info-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" ry="2"/>
            <line x1="9" y1="4" x2="9" y2="20"/>
          </svg>
          <span>Bento {appVersion}</span>
        </div>
        <div class="feedback-modal__info-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>{osName} {osVersion}</span>
        </div>
        {#if activeModule}
          <div class="feedback-modal__info-row">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
            <span>Reported from {activeModule}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Footer ──────────────────────────────────────────────────────── -->
    <div class="feedback-modal__footer">
      <div class="feedback-modal__footer-left">
        {#if error}
          <div class="feedback-modal__error">{error}</div>
        {/if}
      </div>
      <div class="feedback-modal__footer-right">
        <button class="feedback-modal__cancel" onclick={onclose} disabled={submitting}>
          Cancel
        </button>
        <button
          class="feedback-modal__submit"
          onclick={handleSubmit}
          disabled={!canSubmit}
        >
          {#if submitting}
            Submitting…
          {:else}
            {type === 'bug' ? 'Submit Report' : 'Submit Request'}
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>

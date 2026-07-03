<script lang="ts">
  import type { Component } from "svelte";

  let {
    icon: Icon,
    label = "",
    shortcut = "",
    type = "button",
    class: className = "",
    onclick,
  }: {
    icon: Component<{ size?: number; class?: string }>;
    label?: string;
    shortcut?: string;
    type?: "button" | "submit";
    class?: string;
    onclick?: () => void;
  } = $props();
</script>

<button
  class={`dock-btn ${className}`.trim()}
  {type}
  aria-label={label || undefined}
  title={label || undefined}
  onclick={() => onclick?.()}
>
  <span class="dock-btn__icon"><Icon size={16} /></span>
  {#if label}
    <span class="dock-btn__label">{label}</span>
  {/if}
  {#if shortcut}
    <kbd class="dock-btn__shortcut">{shortcut}</kbd>
  {/if}
</button>

<style>
  .dock-btn {
    display: flex;
    height: 36px;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    color: #fff;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
    outline: none;
  }

  .dock-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .dock-btn:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.4);
    outline-offset: 2px;
  }

  .dock-btn:active {
    transform: scale(0.95);
  }

  .dock-btn__icon {
    display: flex;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }

  .dock-btn__label {
    font-size: 13px;
    line-height: 1;
    white-space: nowrap;
  }

  .dock-btn__shortcut {
    display: flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    font-family: monospace;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }
</style>

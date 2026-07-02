<script lang="ts">
  import type { Component } from "svelte";

  let {
    icon: Icon,
    label = "",
    type = "button",
    class: className = "",
    onclick,
  }: {
    icon: Component<{ size?: number; class?: string }>;
    label?: string;
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
  {onclick}
>
  <span class="dock-btn__icon"><Icon size={16} /></span>
</button>

<style>
  .dock-btn {
    display: flex;
    height: 36px;
    width: 36px;
    align-items: center;
    justify-content: center;
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
</style>

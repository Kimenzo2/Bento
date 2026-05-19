<script lang="ts">
  import AppIcon from "$lib/components/AppIcon.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { AppLaunchIconName } from "$lib/data/module-catalog";
  import type { BentoModuleId } from "$lib/desktop/modules";

  interface RecentModule {
    id: string;
    name: string;
    icon: AppLaunchIconName;
    accentHex: string;
    lastUsedMs: number;
  }

  export let recentModules: RecentModule[] = [];
  export let openModule: (moduleId: string) => void | Promise<void>;

  function formatRelativeTime(timestampMs: number): string {
    const diffMs = Date.now() - timestampMs;
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  }
</script>

<!-- Preserved Zone 3 app cards, intentionally not mounted on the dashboard -->
<div class="zone-3">
  <p class="zone-3__label">Your Apps</p>
  {#if recentModules.length > 0}
    <div class="zone-3__tiles">
      {#each recentModules.slice(0, 8) as mod}
        <button
          class="module-tile"
          onclick={() => openModule(mod.id as BentoModuleId)}
          type="button"
          title={mod.name}
        >
          <div
            class="module-tile__icon"
            style="background: color-mix(in srgb, {mod.accentHex} 12%, transparent)"
          >
            <AppIcon
              name={mod.icon}
              size={24}
              strokeWidth={1.8}
              color={mod.accentHex}
            />
          </div>
          <span class="module-tile__name">{mod.name}</span>
          {#if mod.lastUsedMs > 0}
            <span class="module-tile__time">{formatRelativeTime(mod.lastUsedMs)}</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <div class="zone-3__empty">
      <p class="empty-desc">No apps installed</p>
      <Button variant="outline" size="sm" onclick={() => openModule("settings" as BentoModuleId)}>
        Browse Apps
      </Button>
    </div>
  {/if}
</div>

<style>
  .zone-3 {
    margin-top: 28px;
    padding-bottom: 20px;
  }

  .zone-3__label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 12px;
    opacity: 0.35;
  }

  .zone-3__tiles {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 4px;
  }

  .zone-3__tiles::-webkit-scrollbar {
    display: none;
  }

  .module-tile {
    all: unset;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 80px;
    flex-shrink: 0;
    cursor: default;
    padding: 4px 0;
    border-radius: 16px;
    transition: background 120ms ease;
  }

  .module-tile:hover {
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
  }

  .module-tile:active {
    transform: scale(0.97);
  }

  .module-tile__icon {
    width: 52px;
    height: 52px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .module-tile__name {
    font-size: 11px;
    font-weight: 500;
    color: var(--foreground);
    text-align: center;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .module-tile__time {
    font-size: 10px;
    color: var(--muted);
    text-align: center;
    opacity: 0.35;
  }

  .zone-3__empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
</style>

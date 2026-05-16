<script lang="ts">
  import { desktopThemes, type ThemeId } from "$lib/data/themes";
  import { activeTheme, mode, setTheme, toggleMode } from "$lib/stores/theme.store";
  import { toast } from "svelte-sonner";
  import { logger } from "$lib/utils/logger";

  const currentThemeId = $derived($activeTheme.id);
  const currentMode = $derived($mode);

  const selectTheme = async (themeId: ThemeId) => {
    logger.info("Theme card selected", { themeId });

    try {
      await setTheme(themeId);
      toast.success(`Theme switched to ${desktopThemes.find((theme) => theme.id === themeId)?.name ?? themeId}.`);
    } catch (error) {
      logger.error("Theme card selection failed", error);
      toast.error(error instanceof Error ? error.message : "Theme selection failed.");
    }
  };

  const toggleThemeWithLog = async () => {
    const nextMode = currentMode === "dark" ? "light" : "dark";
    logger.info("Settings theme toggle clicked", { currentMode, nextMode });

    try {
      await toggleMode();
      toast.success(`Theme switched to ${nextMode}.`);
    } catch (error) {
      logger.error("Settings theme toggle failed", error);
      toast.error(error instanceof Error ? error.message : "Theme toggle failed.");
    }
  };
</script>

<section class="grid gap-4">
  <div class="flex items-center justify-between gap-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] px-5 py-4">
    <div>
      <p class="font-[var(--font-heading)] text-lg font-semibold text-[var(--foreground)]">
        Active mode: {currentMode}
      </p>
      <p class="text-sm text-[var(--muted)]">
        The shell and document variables update in the same cycle.
      </p>
    </div>
    <button class="theme-chip" type="button" onclick={toggleThemeWithLog}>
      Toggle {currentMode === "dark" ? "light" : "dark"}
    </button>
  </div>

  <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
    {#each desktopThemes as theme}
      <button
        class:theme-card-active={currentThemeId === theme.id}
        class="theme-card text-left"
        type="button"
        onclick={() => void selectTheme(theme.id)}
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-[var(--font-heading)] text-lg font-semibold leading-tight text-[var(--foreground)]">
              {theme.name}
            </p>
            <p class="theme-card__description mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {theme.description}
            </p>
          </div>
          <div class="flex gap-2">
            {#each theme.preview as tone}
              <span class="theme-dot" style={`background:${tone}`}></span>
            {/each}
          </div>
        </div>
      </button>
    {/each}
  </div>
</section>

<script lang="ts">
  import { desktopThemes, type ThemeId } from "$lib/data/themes";
  import { activeTheme, mode, setTheme, toggleMode } from "$lib/stores/theme.store";

  const currentThemeId = $derived($activeTheme.id);
  const currentMode = $derived($mode);

  const previewStyle = (colors: [string, string, string]) =>
    `background: linear-gradient(135deg, ${colors[0]}, ${colors[1]}); box-shadow: inset 0 0 0 1px color-mix(in srgb, ${colors[2]} 45%, transparent);`;

  const selectTheme = (themeId: ThemeId) => {
    setTheme(themeId);
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
    <button class="theme-chip" type="button" onclick={toggleMode}>
      Toggle {currentMode === "dark" ? "light" : "dark"}
    </button>
  </div>

  <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
    {#each desktopThemes as theme}
      <button
        class:theme-card-active={currentThemeId === theme.id}
        class="theme-card text-left"
        type="button"
        onclick={() => selectTheme(theme.id)}
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
        <div class="theme-swatch" style={previewStyle(theme.preview)}></div>
      </button>
    {/each}
  </div>
</section>

// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  // ── Warning filter ─────────────────────────────────────────────
  // Suppress a11y warnings in development so they don't break the UI
  // or cause components to disappear. Remove this filter or comment
  // out the a11y branch to re-enable all warnings.
  //
  // To re-enable a11y warnings, delete (or toggle) the `onwarn` block
  // entirely. All other warnings (TS errors, unused vars, etc.) pass
  // through to the default handler unchanged.
  onwarn: (warning, handler) => {
    // ── Silently drop all accessibility warnings ──
    // These are noisy during rapid development and can hide UI elements
    // when running `bun run check`. Address them when polishing.
    if (warning.code.startsWith("a11y")) {
      return;
    }

    // ── Suppress known non-critical warnings ──
    // Kept in sync with the `--compiler-warnings` list in package.json
    // so that Vite builds (tauri build, release:windows) stay as clean
    // as `svelte-check`.
    const suppressed = new Set([
      "css_unused_selector",
      "svelte_component_deprecated",
      "element_invalid_self_closing_tag",
    ]);
    if (suppressed.has(warning.code)) {
      return;
    }

    // Every other warning (TS, unused vars, etc.) gets the default treatment
    handler(warning);
  },

  kit: {
    adapter: adapter({
      fallback: "index.html",
    }),
    alias: {
      $lib: "./src/lib",
    },
  },
};

export default config;

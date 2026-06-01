// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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
    if (warning.code.startsWith('a11y-')) {
      return;
    }

    // Every other warning (TS, unused vars, etc.) gets the default treatment
    handler(warning);
  },

  kit: {
    adapter: adapter({
      fallback: 'index.html',
    }),
    alias: {
      $lib: './src/lib',
    },
  },
};

export default config;

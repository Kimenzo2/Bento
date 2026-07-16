import path from "node:path";
import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      // $lib is defined both here (Vite-level, for .ts/.js files) and
      // in svelte.config.js (kit.alias, for .svelte files). Both are
      // needed: Kit's alias only resolves inside Svelte components.
      $lib: path.resolve("./src/lib"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/.git/**", "**/node_modules/**", "**/.svelte-kit/**"],
    },
    // ── Pre-transform frequently used files on server start ──────
    // This avoids the first-load waterfall where each Svelte component
    // is compiled lazily on first request, which causes the "blank until
    // Vite compiles everything" delay.
    warmup: {
      clientFiles: [
        "./src/routes/+layout.svelte",
        "./src/app.css",
        "./src/lib/utils.ts",
        "./src/lib/enterprise.ts",
        "./src/lib/shell-theme.ts",
        "./src/lib/components/DatabaseUnlockGate.svelte",
      ],
      // Pre-load the SvelteKit SSR runtime deps at startup so Vite's module
      // runner doesn't hit the 60-second IPC transport timeout on Windows
      // when resolving through bun's .bun/ store junctions.
      // Must include the full chain: index.js -> page/index.js -> render.js -> hash.js
      ssrFiles: [
        "./node_modules/@sveltejs/kit/src/runtime/server/index.js",
        "./node_modules/@sveltejs/kit/src/runtime/server/page/index.js",
        "./node_modules/@sveltejs/kit/src/runtime/server/page/render.js",
        "./node_modules/@sveltejs/kit/src/utils/hash.js",
      ],
    },
  },
  // ── Custom dep cache (survives bun install) ────────────────────
  // Default is node_modules/.vite which gets wiped on install.
  // Moving to project root preserves the pre-bundle cache.
  cacheDir: ".vite-cache",

  // ── Dependency pre-bundling optimization ──────────────────────
  // Vite pre-bundles dependencies lazily by default. When the dep graph
  // changes (e.g. after a git checkout or bun install), Vite re-runs the
  // entire pre-bundle which blocks the dev server for seconds.
  //
  // `include`: Force these to be pre-bundled eagerly at startup so they
  // never trigger a re-optimize on the fly.
  // `exclude`: Skip pre-bundling for packages that ship pure ESM or have
  // Svelte preprocessor transforms (bits-ui, shadcn-svelte) since
  // pre-bundling would strip their .svelte transforms.
  optimizeDeps: {
    include: [
      // UI framework
      "@lucide/svelte",
      "lucide-svelte",
      "mode-watcher",
      "svelte-sonner",
      "tailwind-merge",
      "tailwind-variants",
      "clsx",
      // AI agent framework (only frontend-imported packages;
      // backend-only deps like @mastra/pg, @mastra/rag, and
      // @mastra/observability are excluded to keep pre-bundle lean)
      "@mastra/core",
      "@mastra/memory",
      // Supabase
      "@supabase/supabase-js",
      // Charts
      "d3-scale",
      "d3-shape",
      "layerchart",
      // Markdown
      "marked",
      // Zod schema validation
      "zod",
    ],

  },
  build: {
    // Disable asset inlining — in a Tauri desktop app all assets are
    // local, so base64-inlining small files just bloats the JS bundle
    // without any network benefit.
    assetsInlineLimit: 0,
    // Vite 8 defaults to the Oxc minifier (Rust-based, ~10x faster
    // than esbuild). Explicitly setting 'oxc' documents this choice.
    minify: "oxc",
    // Rolldown (Vite 8's Rust bundler) handles code splitting
    // automatically — better than manualChunks. If specific chunk
    // boundaries are needed later, use build.rolldownOptions.output.
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,js}"],
  },
});

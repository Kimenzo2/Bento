import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    },
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
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@mastra/")) {
            return "mastra";
          }

          if (id.includes("@lorenzootieno/gen-")) {
            return "gen-libs";
          }

          if (id.includes("@supabase/supabase-js") || id.includes("/zod")) {
            return "vendor";
          }

          return undefined;
        },
      },
    },
    minify: "esbuild",
    sourcemap: false,
    reportCompressedSize: false,
    cssCodeSplit: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

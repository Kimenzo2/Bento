import { resolve } from 'path';
import os from 'node:os';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';
  const isProtectedPreview = env.VERCEL === '1' && env.VERCEL_ENV && env.VERCEL_ENV !== 'production';
  const enablePwa = isProduction && !isProtectedPreview;

  return {
    plugins: [
      // React with SWC for faster builds (20x faster than Babel)
      react(),
      // Tailwind CSS v4 Vite plugin
      tailwindcss(),

      // Convert Vite-injected CSS bundle links from render-blocking rel="stylesheet"
      // to the non-blocking preload/onload pattern — matches the Google Fonts approach
      // already used in index.html. Safe because all skeleton/pre-render content uses
      // only inline styles, so no FOUC risk before the CSS resolves.
      {
        name: 'non-blocking-css',
        transformIndexHtml: {
          order: 'post' as const,
          handler(html: string) {
            return html.replace(
              /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
              '<link rel="preload" as="style" crossorigin href="$1" onload="this.onload=null;this.rel=\'stylesheet\'">'
            );
          },
        },
      },

      enablePwa &&
        VitePWA({
          registerType: 'autoUpdate',
          // Use 'script-defer' so vite-plugin-pwa injects registerSW.js with
          // the defer attribute, preventing it from being render-blocking.
          injectRegister: 'script-defer',
          devOptions: {
            enabled: false, // Disable SW in dev to avoid caching issues
          },
          includeAssets: ['genesis-icon.jpg', 'genesis-icon-192.png', 'genesis-icon-512.png', 'genesis-icon-maskable-512.png', 'robots.txt'],
          workbox: {
            // Clean up caches from previous SW versions to prevent stale chunk serving
            cleanupOutdatedCaches: true,
            // Take control of all clients immediately on activation
            clientsClaim: true,
            // Navigation fallback for SPA — only for HTML navigation requests
            navigateFallback: '/index.html',
            // CRITICAL: Never serve index.html for asset/API requests
            navigateFallbackDenylist: [
              /^\/assets\//,
              /^\/api\//,
              /\.(?:js|css|png|jpg|jpeg|svg|ico|woff|woff2|webp|json|txt|map)$/,
            ],
            globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: /^https:\/\/api\.dicebear\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'avatar-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 30,
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
            ],
          },
          manifest: {
            name: 'Genesis - AI Visual Storytelling',
            short_name: 'Genesis',
            description:
              'AI-powered visual storytelling and collaboration platform. Create stunning ebooks, visual stories, and collaborative art.',
            theme_color: '#FF9B71',
            background_color: '#FFF8F3',
            display: 'standalone',
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            categories: ['education', 'entertainment', 'productivity'],
            icons: [
              {
                src: 'genesis-icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
            screenshots: [
              {
                src: 'genesis-icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                form_factor: 'wide',
                label: 'Genesis Homepage',
              },
              {
                src: 'genesis-icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                form_factor: 'narrow',
                label: 'Genesis Mobile',
              },
            ],
            shortcuts: [
              {
                name: 'Create New Story',
                short_name: 'Create',
                description: 'Start creating a new story',
                url: '/?action=create',
                icons: [{ src: 'genesis-icon-192.png', sizes: '192x192' }],
              },
              {
                name: 'Visual Studio',
                short_name: 'Studio',
                description: 'Open Visual Studio',
                url: '/?view=studio',
                icons: [{ src: 'genesis-icon-192.png', sizes: '192x192' }],
              },
            ],
          },
        }),
    ],
    // Path aliases matching tsconfig.json
    resolve: {
      alias: {
        '@': resolve(__dirname, '.'),
        '@components': resolve(__dirname, './components'),
        '@services': resolve(__dirname, './services'),
        '@contexts': resolve(__dirname, './contexts'),
        '@hooks': resolve(__dirname, './hooks'),
        '@utils': resolve(__dirname, './utils'),
        '@types': resolve(__dirname, './types'),
      },
    },
    esbuild: {
      // Drop debugger in prod; keep console.error/warn for observability
      drop: isProduction ? ['debugger'] : [],
      // esbuild is already fast; target modern engines to skip transpilation
      target: 'esnext',
      // Faster JSX transform
      jsx: 'automatic',
    },
    // ─── Pre-bundle everything heavy so dev server starts in < 1 s ──────────
    optimizeDeps: {
      force: false, // only re-bundle when deps actually change
      include: [
        // Core React
        'react', 'react-dom', 'react-dom/client', 'react-router-dom',
        // Supabase
        '@supabase/supabase-js',
        // i18n
        'i18next', 'react-i18next', 'i18next-browser-languagedetector', 'i18next-http-backend',
        // UI / motion
        'framer-motion', 'lucide-react',
        // Radix primitives (one import = no repeated crawling)
        '@radix-ui/react-alert-dialog', '@radix-ui/react-avatar',
        '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-label', '@radix-ui/react-popover',
        '@radix-ui/react-progress', '@radix-ui/react-scroll-area',
        '@radix-ui/react-select', '@radix-ui/react-separator',
        '@radix-ui/react-slider', '@radix-ui/react-slot',
        '@radix-ui/react-switch', '@radix-ui/react-tabs',
        '@radix-ui/react-tooltip',
        // Other runtime deps
        'clsx', 'tailwind-merge', 'class-variance-authority',
        'sonner', 'react-error-boundary',
        'bytez.js',
      ],
      // Exclude server-only packages from client bundle
      exclude: ['@mastra/core', '@mastra/pg', '@mastra/rag', '@mastra/memory',
                '@hono/node-server', 'newrelic', '@arcjet/node'],
    },
    build: {
      commonjsOptions: {
        include: [/bytez\.js/, /node_modules/],
        // Avoid transforming ESM-only packages → faster
        transformMixedEsModules: false,
      },
      target: 'esnext',
      minify: 'esbuild',
      // Only generate sourcemaps in production (hidden); skip entirely in dev builds
      sourcemap: isProduction ? 'hidden' : false,
      chunkSizeWarningLimit: 2000,
      // ── Parallel workers for Rollup (use all CPU cores) ─────────────────
      rollupOptions: {
        maxParallelFileOps: Math.max(1, (os.cpus?.()?.length ?? 4) - 1),
        output: {
          // Fine-grained manual chunks → smaller initial bundle, better long-term cache
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Radix UI
              if (id.includes('@radix-ui')) return 'vendor-radix';
              // Supabase
              if (id.includes('@supabase')) return 'vendor-supabase';
              // Animation
              if (id.includes('framer-motion')) return 'vendor-motion';
              // Icons
              if (id.includes('lucide-react')) return 'vendor-icons';
            }
          },
        },
      },
      // Avoid emitting assets to the wrong place
      assetsDir: 'assets',
      // skip gzip reporting (saves ~100ms per build)
      reportCompressedSize: false,
    },
    // ─── Dev server ──────────────────────────────────────────────────────────
    server: {
      port: 3000,
      strictPort: true,
      // Reduce HMR full-reload latency
      hmr: {
        overlay: true,
        timeout: 1000,
      },
      // Allow all local file access (no repeated symlink resolution)
      fs: {
        strict: false,
        cachedChecks: true,
      },
      // Warm up the most-accessed files so first HMR is instant
      warmup: {
        clientFiles: [
          './App.tsx',
          './MainApp.tsx',
          './AppRouter.tsx',
          './components/Navigation.tsx',
          './contexts/AuthContext.tsx',
        ],
      },
    },
    // Preview server config
    preview: {
      port: 4173,
      strictPort: true,
    },
  };
});

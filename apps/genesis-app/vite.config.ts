import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Converts Vite-injected render-blocking resources to non-blocking equivalents.
 * CSS: preload + onload swap (same pattern as Google Fonts in index.html).
 * Script: adds defer to module scripts for audit-tool compliance.
 */
function nonBlockingAssets(): Plugin {
  return {
    name: 'non-blocking-assets',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // CSS: convert <link rel="stylesheet"> to preload+onload with noscript fallback
        html = html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
          (_match, href) =>
            `<link rel="preload" as="style" crossorigin href="${href}" onload="this.onload=null;this.rel='stylesheet'">` +
            `\n<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`,
        );
        // Script: add defer to module scripts (redundant per spec, satisfies audits)
        html = html.replace(
          /<script type="module" crossorigin src="(\/assets\/[^"]+\.js)">/g,
          '<script type="module" defer crossorigin src="$1">',
        );
        return html;
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';
  const devApiPort = env.DEV_API_PORT || '3002';
  const devApiTarget = env.VITE_DEV_API_TARGET || `http://localhost:${devApiPort}`;
  const isProtectedPreview = env.VERCEL === '1' && env.VERCEL_ENV && env.VERCEL_ENV !== 'production';
  const enablePwa = isProduction && !isProtectedPreview;

  return {
    plugins: [
      // React with SWC for faster builds (20x faster than Babel)
      react(),
      // Tailwind v4 Vite integration replaces the PostCSS plugin path.
      tailwindcss(),
      // Non-blocking CSS and deferred scripts for Core Web Vitals
      nonBlockingAssets(),

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
            // Allow larger precache entries (some chunks exceed the default 2 MiB limit)
            maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            // Skip waiting so the new SW activates immediately without requiring all tabs to close
            skipWaiting: true,
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
            globPatterns: ['**/*.{css,html,ico,woff,woff2}'],
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
                src: 'genesis-icon-48.png',
                sizes: '48x48',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-72.png',
                sizes: '72x72',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-96.png',
                sizes: '96x96',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-128.png',
                sizes: '128x128',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-144.png',
                sizes: '144x144',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-152.png',
                sizes: '152x152',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: 'genesis-icon-384.png',
                sizes: '384x384',
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
                src: 'genesis-icon-maskable-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
              },
              {
                src: 'genesis-icon-maskable-384.png',
                sizes: '384x384',
                type: 'image/png',
                purpose: 'maskable',
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
      dedupe: ['react', 'react-dom'],
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
    // Vite 8 uses Oxc for transforms by default; no explicit config needed.
    // Production minification (oxc) automatically strips debugger statements.
    // ─── Pre-bundle everything heavy so dev server starts in < 1 s ──────────
    optimizeDeps: {
      force: false, // only re-bundle when deps actually change
      include: [
        // Core React
        'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'react-router',
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
      ],
      // Exclude server-only packages from client bundle
      exclude: ['@mastra/core', '@mastra/pg', '@mastra/rag', '@mastra/memory',
                '@hono/node-server',
                '@react-email/components', 'react-email'],
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
      },
      target: 'esnext',
      minify: 'oxc',
      // Only generate sourcemaps in production (hidden); skip entirely in dev builds
      sourcemap: isProduction ? 'hidden' : false,
      // Warn at 500KB — action required. Previously 2000 which hid regressions.
      chunkSizeWarningLimit: 500,
      // ── Rolldown output configuration ─────────────────
      rollupOptions: {
        // Prevent server-only code from being bundled into client
        external: [
          '@mastra/core',
          '@mastra/pg',
          '@mastra/rag',
          '@mastra/memory',
          '@mastra/observability',
          '@hono/node-server',
          // Server-side mastra folder should never be imported by client
          /^\.\.\/mastra\//,
          /^\.\/mastra\//,
        ],
        output: {
          // Fine-grained manual chunks → smaller initial bundle, better long-term cache
          manualChunks(id: string) {
            // ── Vendor chunks (from node_modules) ──
            if (id.includes('node_modules')) {
              // Radix UI - always needed for UI
              if (id.includes('@radix-ui')) return 'vendor-radix';
              // Supabase - auth/db core
              if (id.includes('@supabase')) return 'vendor-supabase';
              // Animation
              if (id.includes('framer-motion')) return 'vendor-motion';
              // Icons
              if (id.includes('lucide-react')) return 'vendor-icons';
              // i18n
              if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
              // PDF export - lazy loaded on export action
              if (id.includes('jspdf')) return 'vendor-export';
              // Image capture - lazy loaded on export action
              if (id.includes('html-to-image') || id.includes('html2canvas')) return 'vendor-export';
              // React Email - lazy loaded on email send
              if (id.includes('@react-email') || id.includes('react-email')) return 'vendor-email';
              // Sentry - should be lazy loaded
              if (id.includes('@sentry')) return 'vendor-sentry';
              // Markdown - lazy loaded for blog/learn pages
              if (id.includes('react-markdown') || id.includes('remark')) return 'vendor-markdown';
              // ReactFlow - lazy loaded for StoryCanvas
              if (id.includes('@xyflow')) return 'vendor-flow';
            }

            // ── Application code chunks ──
            // Services that should be co-located
            if (id.includes('/services/supabaseClient')) return 'vendor-supabase';
            if (id.includes('/services/profileService')) return 'vendor-supabase';

            // AI services - lazy loaded when generating
            if (id.includes('/services/aiGatewayService')) return 'services-ai';
            if (id.includes('/services/grokService')) return 'services-ai';

            // Email service - lazy loaded when sending
            if (id.includes('/services/emailService')) return 'vendor-email';
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
      allowedHosts: ['.ngrok-free.dev', '.ngrok.io'],
      // Proxy API routes to local dev-api-server (default: port 3002)
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
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


import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        includeAssets: ['favicon.ico', 'genesis-icon.jpg', 'robots.txt'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/api\.dicebear\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'avatar-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        manifest: {
          name: 'Genesis - AI Visual Storytelling',
          short_name: 'Genesis',
          description: 'AI-powered visual storytelling and collaboration platform. Create stunning ebooks, visual stories, and collaborative art.',
          theme_color: '#FF9B71',
          background_color: '#FFF8F3',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          categories: ['education', 'entertainment', 'productivity'],
          icons: [
            {
              src: 'genesis-icon.jpg',
              sizes: '192x192',
              type: 'image/jpeg',
              purpose: 'any'
            },
            {
              src: 'genesis-icon.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'any'
            },
            {
              src: 'genesis-icon.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'maskable'
            }
          ],
          screenshots: [
            {
              src: 'genesis-icon.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              form_factor: 'wide',
              label: 'Genesis Homepage'
            },
            {
              src: 'genesis-icon.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              form_factor: 'narrow',
              label: 'Genesis Mobile'
            }
          ],
          shortcuts: [
            {
              name: 'Create New Story',
              short_name: 'Create',
              description: 'Start creating a new story',
              url: '/?action=create',
              icons: [{ src: 'genesis-icon.jpg', sizes: '192x192' }]
            },
            {
              name: 'Visual Studio',
              short_name: 'Studio',
              description: 'Open Visual Studio',
              url: '/?view=studio',
              icons: [{ src: 'genesis-icon.jpg', sizes: '192x192' }]
            }
          ]
        }
      })
    ],
    esbuild: {
      // Keep console.error and console.warn in production for debugging
      drop: mode === 'production' ? ['debugger'] : [],
    },
    optimizeDeps: {
      include: ['bytez.js']
    },
    build: {
      commonjsOptions: {
        include: [/bytez\.js/, /node_modules/]
      },
      // Production optimizations
      target: 'es2020',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // Keep console.error and console.warn for debugging
          drop_debugger: mode === 'production',
          pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : []
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-utils': ['@supabase/supabase-js', 'i18next', 'react-i18next', 'framer-motion', 'lucide-react']
          }
        }
      },
      // Generate source maps for error tracking
      sourcemap: true,
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1200,
    },
    // Performance optimizations
    server: {
      hmr: {
        overlay: true
      }
    }
  }
})

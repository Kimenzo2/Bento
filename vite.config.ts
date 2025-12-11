import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      // React with SWC for faster builds (20x faster than Babel)
      react(),
      // Tailwind CSS v4 Vite plugin
      tailwindcss(),
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
          orientation: 'portrait',
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
      // Keep console.error and console.warn in production for debugging
      drop: isProduction ? ['debugger'] : [],
    },
    optimizeDeps: {
      include: ['bytez.js', 'react', 'react-dom', 'react-router-dom']
    },
    build: {
      commonjsOptions: {
        include: [/bytez\.js/, /node_modules/]
      },
      // Modern ES2022 target (widely supported and compatible with Lightning CSS)
      target: 'esnext',
      minify: 'esbuild', // esbuild is faster than terser
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-utils': ['@supabase/supabase-js', 'i18next', 'react-i18next'],
            'vendor-ui': ['framer-motion', 'lucide-react']
          }
        }
      },
      // Generate source maps for error tracking
      sourcemap: isProduction ? 'hidden' : true,
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1500,
    },
    // Performance optimizations
    server: {
      hmr: {
        overlay: true
      },
      // Warm up frequently used files
      warmup: {
        clientFiles: [
          './App.tsx',
          './components/Navigation.tsx',
          './components/CreationCanvas.tsx',
        ]
      }
    },
    // Preview server config
    preview: {
      port: 4173,
      strictPort: true,
    }
  }
})

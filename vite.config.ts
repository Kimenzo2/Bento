
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
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Genesis Visual Studio',
          short_name: 'Genesis',
          description: 'AI-powered visual storytelling and collaboration platform',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
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

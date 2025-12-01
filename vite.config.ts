
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    optimizeDeps: {
      include: ['bytez.js']
    },
    build: {
      commonjsOptions: {
        include: [/bytez\.js/, /node_modules/]
      }
    }
  }
})

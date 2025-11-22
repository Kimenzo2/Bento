
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the Gemini Service
      'import.meta.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY),
      // Polyfill process.env.PAYSTACK_PUBLIC_KEY for the Paystack Service
      'import.meta.env.VITE_PAYSTACK_PUBLIC_KEY': JSON.stringify(env.VITE_PAYSTACK_PUBLIC_KEY || '')
    }
  }
})

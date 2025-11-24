
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.VITE_GEMINI_API_KEY for the Gemini Service
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      // Polyfill process.env.PAYSTACK_PUBLIC_KEY for the Paystack Service
      'process.env.PAYSTACK_PUBLIC_KEY': JSON.stringify(env.PAYSTACK_PUBLIC_KEY || '')
    }
  }
})

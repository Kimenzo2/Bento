
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the Gemini Service
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process.env.PAYSTACK_PUBLIC_KEY for the Paystack Service
      'process.env.PAYSTACK_PUBLIC_KEY': JSON.stringify(env.PAYSTACK_PUBLIC_KEY || '')
    }
  }
})

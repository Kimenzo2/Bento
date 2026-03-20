/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Type declarations for environment variables.
 * All VITE_ prefixed env vars are exposed to the client.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

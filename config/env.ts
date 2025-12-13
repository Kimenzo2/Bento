/**
 * @module Environment
 * @description Environment validation and typed access to environment variables
 * 
 * Features:
 * - Runtime validation of required environment variables
 * - Typed access to configuration
 * - Development vs production mode detection
 * - Missing variable warnings
 * 
 * @example
 * ```typescript
 * import { env, validateEnv } from '@config/env';
 * 
 * // Access typed env variables
 * const apiUrl = env.SUPABASE_URL;
 * 
 * // Validate on app start
 * validateEnv();
 * ```
 */

import { z } from 'zod';
import { logger } from '../services/logger';

/**
 * Environment variable schema
 */
const envSchema = z.object({
  // Supabase
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  
  // AI Services
  VITE_GEMINI_API_KEY: z.string().optional(),
  VITE_BYTEZ_API_KEY: z.string().optional(),
  VITE_GROK_API_KEY: z.string().optional(),
  
  // Payments
  VITE_PAYSTACK_PUBLIC_KEY: z.string().optional(),
  
  // App Configuration
  VITE_APP_NAME: z.string().default('Genesis'),
  VITE_APP_VERSION: z.string().optional(),
  
  // Feature Flags
  VITE_ENABLE_ANALYTICS: z.string().transform(v => v === 'true').optional(),
  VITE_ENABLE_DEBUG: z.string().transform(v => v === 'true').optional(),
  
  // Node environment
  MODE: z.enum(['development', 'production', 'test']).default('development'),
  DEV: z.boolean().default(true),
  PROD: z.boolean().default(false),
});

type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 */
function parseEnv(): EnvConfig {
  const rawEnv = {
    ...import.meta.env,
    MODE: import.meta.env.MODE || 'development',
    DEV: import.meta.env.DEV ?? true,
    PROD: import.meta.env.PROD ?? false,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    logger.warn('Environment validation issues', { issues });
    
    // Return partial env with defaults
    return envSchema.parse({
      MODE: 'development',
      DEV: true,
      PROD: false,
    });
  }

  return result.data;
}

/**
 * Validated environment configuration
 */
export const env = parseEnv();

/**
 * Check if running in development mode
 */
export const isDevelopment = env.MODE === 'development' || env.DEV;

/**
 * Check if running in production mode
 */
export const isProduction = env.MODE === 'production' || env.PROD;

/**
 * Check if running in test mode
 */
export const isTest = env.MODE === 'test';

/**
 * Validate required environment variables and log warnings
 * Call this early in application startup
 */
export function validateEnv(): boolean {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ] as const;

  const optionalButRecommended = [
    'VITE_GEMINI_API_KEY',
  ] as const;

  const missing: string[] = [];
  const recommended: string[] = [];

  for (const key of requiredVars) {
    if (!import.meta.env[key]) {
      missing.push(key);
    }
  }

  for (const key of optionalButRecommended) {
    if (!import.meta.env[key]) {
      recommended.push(key);
    }
  }

  if (missing.length > 0) {
    logger.error('Missing required environment variables', null, { missing });
  }

  if (recommended.length > 0 && isDevelopment) {
    logger.warn('Missing recommended environment variables', { recommended });
  }

  if (isDevelopment) {
    logger.info('Environment validated', {
      mode: env.MODE,
      supabaseConfigured: !!env.VITE_SUPABASE_URL,
      aiConfigured: !!env.VITE_GEMINI_API_KEY,
    });
  }

  return missing.length === 0;
}

/**
 * Get feature flag value with default
 */
export function getFeatureFlag(flag: 'analytics' | 'debug', defaultValue = false): boolean {
  switch (flag) {
    case 'analytics':
      return env.VITE_ENABLE_ANALYTICS ?? defaultValue;
    case 'debug':
      return env.VITE_ENABLE_DEBUG ?? isDevelopment;
    default:
      return defaultValue;
  }
}

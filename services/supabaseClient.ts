import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables!\n' +
        `VITE_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}\n` +
        `VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗'}\n` +
        'Please check your .env file and ensure these variables are set.'
    );
}

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true, // CRITICAL: This detects the OAuth hash and stores the session
        }
    }
);

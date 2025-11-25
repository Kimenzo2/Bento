import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        'CRITICAL: Missing Supabase environment variables!\n' +
        `VITE_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}\n` +
        `VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗'}\n` +
        'The application will load but authentication and database features will NOT work.\n' +
        'Please set these variables in your Vercel project settings.'
    );

    // Create a dummy client that warns when used, to prevent app crash on load
    client = {
        auth: {
            getSession: async () => ({ data: { session: null }, error: new Error("Supabase not configured") }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            signInWithOAuth: async () => ({ error: new Error("Supabase not configured") }),
            signInWithPassword: async () => ({ data: null, error: new Error("Supabase not configured") }),
            signUp: async () => ({ data: null, error: new Error("Supabase not configured") }),
            signOut: async () => ({ error: new Error("Supabase not configured") }),
            getUser: async () => ({ data: { user: null }, error: new Error("Supabase not configured") }),
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: async () => ({ data: null, error: new Error("Supabase not configured") }),
                    maybeSingle: async () => ({ data: null, error: new Error("Supabase not configured") }),
                    data: null, error: new Error("Supabase not configured")
                }),
                data: null, error: new Error("Supabase not configured")
            })
        }),
        storage: {
            from: () => ({
                upload: async () => ({ data: null, error: new Error("Supabase not configured") }),
                getPublicUrl: () => ({ data: { publicUrl: "" } })
            })
        }
    } as any;
} else {
    client = createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            }
        }
    );
}

export const supabase = client as any;

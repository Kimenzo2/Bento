import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
})

// Helper to get current user
export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
}

// Helper to check if user is authenticated
export const isAuthenticated = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session
}

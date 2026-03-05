/**
 * @fileoverview Shared Supabase admin client for Mastra agent tools.
 *
 * All agent tools that need DB access import `db` from here rather than
 * instantiating a new client per tool. Reads credentials exclusively from
 * server-side environment variables — never from VITE_ prefixed vars.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    '[mastra/db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. ' +
    'DB operations in agent tools will fail.',
  );
}

export const db: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Account Deletion API Route
 *
 * Securely deletes a user's account and all associated data.
 * Uses supabase.auth.admin.deleteUser() which triggers ON DELETE CASCADE
 * across all tables with foreign keys referencing auth.users(id).
 *
 * The caller must be authenticated — JWT is verified via supabase.auth.getUser().
 * Users can only delete their own account.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers — restrict to known origins
  const allowedOrigins = ['https://iamazeyou.me', 'http://localhost:3000', 'http://localhost:5173'];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 1. Verify the caller's identity ────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── 2. Delete the user from auth.users ─────────────────────────────────
  // ON DELETE CASCADE handles: profiles, projects, visual_generations,
  // notifications, shared_books, user_gamification, user_achievements,
  // user_daily_challenges, user_analytics_summary, and all other FK tables.
  try {
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[delete-account] Failed to delete user:', deleteError);
      return res.status(500).json({ error: 'Failed to delete account' });
    }

    console.log(`[delete-account] Deleted user ${user.id} (${user.email})`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[delete-account] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

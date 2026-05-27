-- 018_dodo_revoke_public_rpc.sql
-- Payment webhook sync functions are trigger/server-side internals, not public RPCs.

revoke execute on function public.apply_dodo_webhook_profile_sync(text, jsonb)
  from public, anon, authenticated;

revoke execute on function public.sync_dodo_profile_from_processed_webhook()
  from public, anon, authenticated;

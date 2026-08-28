-- Supabase's RLS auto-enable event trigger must not be exposed as a Data API RPC.
-- Revoking EXECUTE does not disable the database event trigger itself.

revoke all on function public.rls_auto_enable() from public, anon, authenticated;

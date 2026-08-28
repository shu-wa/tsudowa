-- Supabase's hosted RLS auto-enable event trigger must not be exposed as a Data
-- API RPC. The function is not present in every local Supabase image, so keep
-- the migration portable while revoking it whenever the hosted helper exists.
-- Revoking EXECUTE does not disable the database event trigger itself.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

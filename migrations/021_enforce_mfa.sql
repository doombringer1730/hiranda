-- 021: Two-factor enforcement in the database.
--
-- Users who turn on an authenticator app must finish the second step before
-- their session can touch any data — not just in the UI (middleware sends
-- them to /verify-2fa) but at the database, so a password alone can't be
-- used against the API directly. Users without 2FA are unaffected.
--
-- mfa_ok() is true when the session is aal2, or when the user has no
-- verified factor. It's a security-definer function because the
-- authenticated role can't read auth.mfa_factors itself. Each public table
-- gets one RESTRICTIVE policy that ANDs this onto its existing policies.
-- watch_sessions / watch_messages (the sync feature) are left as they are.
--
-- Safe to re-run.

create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated, service_role;

do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and c.relname not in ('watch_sessions', 'watch_messages')
  loop
    execute format('drop policy if exists "Require 2FA when enabled" on public.%I', t);
    execute format('create policy "Require 2FA when enabled" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

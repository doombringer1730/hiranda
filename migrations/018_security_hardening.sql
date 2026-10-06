-- 018: Security hardening — tightens what each role can reach without
-- changing anything the app does today.
--
-- 1. Spotify tokens are private. Profiles stay readable by your partner, but
--    the OAuth token columns are no longer selectable through the API at
--    all; only the server's service role (the Spotify routes) reads them.
-- 2. Couple membership is locked. Members can still edit the couple's
--    settings, but can't rewrite user1_id / user2_id / invite_token. Joining
--    goes through accept_invite(), a security-definer function, as before.
-- 3. Every UPDATE policy gets a WITH CHECK equal to its USING clause, so an
--    edit can never move a row outside your couple (e.g. by rewriting
--    created_by). watch_sessions / watch_messages (the sync feature) are left
--    exactly as they are.
-- 4. The anonymous role loses all table access. Nothing signed-out reads
--    tables (the browser extension only uses realtime broadcast channels).
-- 5. Upload size limits on the photos, avatars, banners and epubs buckets
--    (videos untouched). Existing files are unaffected.
--
-- MAINTENANCE: profiles SELECT and couple UPDATE are now granted per column.
-- A new profiles column the app reads, or a new couple column it updates,
-- needs a matching GRANT — see the bottom of this file.
--
-- Safe to re-run.

-- ── 1. Private Spotify tokens ──
revoke select on public.profiles from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name not in ('spotify_access_token', 'spotify_refresh_token', 'spotify_token_expires_at');
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;

-- ── 2. Couple membership can't be rewritten ──
revoke update on public.couple from anon, authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'couple'
     and column_name in ('together_since', 'show_timer', 'theme', 'jellyfin_url', 'jellyfin_api_key',
                         'real_debrid_api_key', 'torbox_api_key', 'theater_passcode_hash');
  execute format('grant update (%s) on public.couple to authenticated', cols);
end $$;

-- ── 3. Updates must keep the row inside your couple ──
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname, qual
      from pg_policies
     where schemaname = 'public' and cmd = 'UPDATE' and with_check is null and qual is not null
       and tablename not in ('watch_sessions', 'watch_messages')
  loop
    execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, p.qual);
  end loop;
end $$;

-- ── 4. No anonymous table access ──
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
revoke execute on function public.accept_invite(text, uuid) from anon, public;
grant execute on function public.accept_invite(text, uuid) to authenticated;

-- ── 5. Upload limits (videos untouched) ──
update storage.buckets set file_size_limit = 50 * 1024 * 1024  where id = 'photos';
update storage.buckets set file_size_limit = 10 * 1024 * 1024  where id in ('avatars', 'banners');
update storage.buckets set file_size_limit = 200 * 1024 * 1024 where id = 'epubs';

-- To expose a NEW profiles column to the app:   grant select (col) on public.profiles to authenticated;
-- To let the app update a NEW couple column:    grant update (col) on public.couple to authenticated;

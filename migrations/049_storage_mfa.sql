-- 049: Two-factor enforcement for storage too.
--
-- 021 added a restrictive "Require 2FA when enabled" policy to every table in
-- public, but files live in storage.objects, which it never covered. So with
-- just a password (a session that hasn't done the second step), someone could
-- call the storage API directly and list, download or sign the couple's
-- photos, videos and books, and upload or delete files.
--
-- Same policy, same mfa_ok() from 021: ANDed onto every storage policy, so
-- users without 2FA are unaffected and a 2FA user needs an aal2 session.
-- Public avatar/banner URLs (/object/public/) don't go through policies and
-- keep loading; the service role bypasses them as before.
--
-- Run after 021 (needs public.mfa_ok()). Safe to re-run. 003 drops every
-- storage policy before recreating its own, so run this again after 003.

drop policy if exists "Require 2FA when enabled" on storage.objects;
create policy "Require 2FA when enabled"
  on storage.objects as restrictive for all to authenticated
  using ((select public.mfa_ok()))
  with check ((select public.mfa_ok()));

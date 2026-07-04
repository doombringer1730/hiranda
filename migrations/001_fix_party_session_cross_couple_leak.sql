-- 001 — Fix cross-couple leak on watch_sessions party rows
--
-- Problem: a legacy policy let ANY authenticated user (from any couple) read
-- every watch_session whose source_type = 'party', exposing another couple's
-- session metadata (title, party_url, thumbnail_url, imdb_id, source URLs…).
-- The couple-scoped chat inside stayed private, but the session row leaked.
--
-- Fix: drop the blanket policy. The existing "Couple members can read watch
-- sessions" policy already grants each couple access to their own party
-- sessions, so no replacement is needed. RLS policies are permissive (OR'd),
-- so removing this one only revokes cross-couple access.
--
-- Applied to production 2026-07-04.

drop policy if exists "Authenticated users can read party sessions"
  on public.watch_sessions;

-- 050: Who may join a couple's "shared space" realtime channel.
--
-- The shared-space hook (src/lib/shared-space.tsx) shows each partner where
-- the other is in the app (which memory, which answer they're typing) over a
-- PRIVATE Realtime channel, `space:<couple id>`: broadcast and presence only,
-- nothing is written to the database. A private channel is checked against
-- these policies on realtime.messages when someone joins: SELECT to receive,
-- INSERT to send / track presence. Only the couple's two members get either,
-- and (like 021) only once they've done the 2FA step if they turned it on.
--
-- Until this runs, the channel refuses everyone and the "partner is here"
-- hints simply don't show. Other channels are unaffected (the old public
-- ones don't use these policies; item h moves them over).
--
-- Safe to re-run.

drop policy if exists "Couple members receive their shared space" on realtime.messages;
create policy "Couple members receive their shared space"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and split_part((select realtime.topic()), ':', 1) = 'space'
    and exists (
      select 1 from public.couple c
       where c.id::text = split_part((select realtime.topic()), ':', 2)
         and (c.user1_id = (select auth.uid()) or c.user2_id = (select auth.uid()))
    )
    and (select public.mfa_ok())
  );

drop policy if exists "Couple members share their shared space" on realtime.messages;
create policy "Couple members share their shared space"
  on realtime.messages for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and split_part((select realtime.topic()), ':', 1) = 'space'
    and exists (
      select 1 from public.couple c
       where c.id::text = split_part((select realtime.topic()), ':', 2)
         and (c.user1_id = (select auth.uid()) or c.user2_id = (select auth.uid()))
    )
    and (select public.mfa_ok())
  );

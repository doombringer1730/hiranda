-- 046: You can only create a couple for yourself, alone.
--
-- The insert policy only checked user1_id, so any signed-in user could insert
-- couple (user1_id = me, user2_id = <anyone>) straight through the API and
-- become that person's "partner": the storage policies (003) then let them
-- read every photo, video and book the other person uploaded, and the app
-- could pick the forged couple as the victim's space.
--
-- Now a new couple must start empty: user2_id (and paired_at) can only be set
-- by accept_invite(), which checks the invite token. Every insert the app
-- makes is { user1_id } alone, so nothing in the app changes.
--
-- Safe to re-run.

drop policy if exists "User can create couple" on couple;
create policy "User can create couple"
  on couple for insert
  with check (auth.uid() = user1_id and user2_id is null and paired_at is null);

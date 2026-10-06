-- 023: Talk time — a daily nudge to put the phones down and just talk.
--
-- One row per session. Either partner starts one (15 minutes by default, or
-- any length they pick); both see the same countdown. A session counts
-- toward the streak once it has run its course (ended_at is null and the
-- time is up, or `completed` was set) or ran at least half its length.
--
-- Couple members can read and update their couple's sessions (to end early
-- or add time); you can only start one as yourself, in your own couple.
-- Only `minutes`, `ended_at` and `completed` are updatable, and started_at
-- always comes from the server, so the streak can't be back-dated.
--
-- Safe to re-run.

create table if not exists talk_sessions (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references couple(id) on delete cascade,
  started_by  uuid not null references auth.users on delete cascade,
  minutes     int  not null check (minutes between 1 and 180),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  completed   boolean not null default false
);
create index if not exists talk_sessions_couple_idx on talk_sessions (couple_id, started_at desc);
alter table talk_sessions enable row level security;

drop policy if exists "Couple members can read talk sessions" on talk_sessions;
create policy "Couple members can read talk sessions" on talk_sessions for select using (
  exists (select 1 from couple c where c.id = talk_sessions.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Couple members start talk sessions" on talk_sessions;
create policy "Couple members start talk sessions" on talk_sessions for insert with check (
  started_by = auth.uid()
  and exists (select 1 from couple c where c.id = talk_sessions.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Couple members update talk sessions" on talk_sessions;
create policy "Couple members update talk sessions" on talk_sessions for update using (
  exists (select 1 from couple c where c.id = talk_sessions.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

-- Two-factor, like every other table (see 021).
drop policy if exists "Require 2FA when enabled" on talk_sessions;
create policy "Require 2FA when enabled" on talk_sessions as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

revoke all on talk_sessions from anon;
revoke insert, update, delete on talk_sessions from authenticated;
grant select on talk_sessions to authenticated;
grant insert (couple_id, started_by, minutes) on talk_sessions to authenticated;
grant update (minutes, ended_at, completed) on talk_sessions to authenticated;

-- Live: both phones see a session start, stretch or end the moment it happens.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'talk_sessions') then
    alter publication supabase_realtime add table talk_sessions;
  end if;
end $$;

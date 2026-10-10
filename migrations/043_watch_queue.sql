-- 043: "Up next" in the Theater (src/theater/README.md — a Theater table).
--
-- watch_queue: YouTube videos either of you lines up while watching. When a
-- video ends, the session moves on to the oldest unplayed one for both of
-- you (played_at marks it done). Scoped through the parent session's couple,
-- exactly like watch_messages.
--
-- Until this runs, the player simply has no "Up next" list.
--
-- Safe to re-run.

create table if not exists watch_queue (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references watch_sessions on delete cascade,
  video_id    text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title       text not null check (char_length(title) <= 200),
  thumb       text check (char_length(thumb) <= 500),
  duration    integer,
  added_by    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  played_at   timestamptz
);
create index if not exists watch_queue_session_idx on watch_queue (session_id, created_at);
alter table watch_queue enable row level security;

drop policy if exists "Couple members see the queue" on watch_queue;
create policy "Couple members see the queue" on watch_queue for select using (exists (
  select 1 from watch_sessions ws join couple c
    on (c.user1_id = ws.created_by or c.user2_id = ws.created_by)
  where ws.id = watch_queue.session_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Couple members add to the queue" on watch_queue;
create policy "Couple members add to the queue" on watch_queue for insert with check (
  added_by = auth.uid() and exists (
  select 1 from watch_sessions ws join couple c
    on (c.user1_id = ws.created_by or c.user2_id = ws.created_by)
  where ws.id = watch_queue.session_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Couple members play from the queue" on watch_queue;
create policy "Couple members play from the queue" on watch_queue for update using (exists (
  select 1 from watch_sessions ws join couple c
    on (c.user1_id = ws.created_by or c.user2_id = ws.created_by)
  where ws.id = watch_queue.session_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Couple members remove from the queue" on watch_queue;
create policy "Couple members remove from the queue" on watch_queue for delete using (exists (
  select 1 from watch_sessions ws join couple c
    on (c.user1_id = ws.created_by or c.user2_id = ws.created_by)
  where ws.id = watch_queue.session_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Require 2FA when enabled" on watch_queue;
create policy "Require 2FA when enabled" on watch_queue as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

revoke all on watch_queue from anon;
grant select, insert, update, delete on watch_queue to authenticated;

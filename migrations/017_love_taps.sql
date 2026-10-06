-- 017: "Thinking of you" taps on Home.
--
-- One row per tap. Couple members can read each other's taps (to show
-- "Riley thought of you · 2h ago"); you can only insert your own.
-- Safe to re-run.

create table if not exists love_taps (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references auth.users on delete cascade,
  created_at  timestamptz default now()
);
create index if not exists love_taps_from_idx on love_taps (from_user, created_at desc);
alter table love_taps enable row level security;

drop policy if exists "Couple members can read love taps" on love_taps;
create policy "Couple members can read love taps" on love_taps for select using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = love_taps.from_user or c.user2_id = love_taps.from_user)));
drop policy if exists "Users send their own love taps" on love_taps;
create policy "Users send their own love taps" on love_taps for insert with check (auth.uid() = from_user);

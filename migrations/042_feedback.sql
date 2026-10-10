-- 042: "Enjoying Hiranda?"
--
-- feedback: one tap on Home, a few days after you sign up. rating is
-- 3 (love it), 2 (it's okay) or 1 (not really), plus an optional note. A
-- row with no rating means "not now": the card comes back two weeks later.
-- A rated row means it never asks you again.
--
-- Only you can see your own answers. Whoever runs Hiranda reads them in the
-- Supabase dashboard (the service role skips these policies).
--
-- Until this runs, the card simply never shows.
--
-- Safe to re-run.

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade default auth.uid(),
  couple_id   uuid references couple(id) on delete set null,
  rating      smallint check (rating between 1 and 3),
  note        text check (char_length(note) <= 1000),
  created_at  timestamptz not null default now()
);
create index if not exists feedback_user_idx on feedback (user_id, created_at desc);
alter table feedback enable row level security;

drop policy if exists "You see your own feedback" on feedback;
create policy "You see your own feedback" on feedback for select using (user_id = auth.uid());

drop policy if exists "You give feedback" on feedback;
create policy "You give feedback" on feedback for insert with check (
  user_id = auth.uid()
  and (couple_id is null or exists (select 1 from couple c where c.id = feedback.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid()))));

drop policy if exists "You add a note to your feedback" on feedback;
create policy "You add a note to your feedback" on feedback for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Require 2FA when enabled" on feedback;
create policy "Require 2FA when enabled" on feedback as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

revoke all on feedback from anon;
revoke delete on feedback from authenticated;
grant select, insert, update on feedback to authenticated;

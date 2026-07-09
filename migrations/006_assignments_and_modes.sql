-- 006: Assignments calendar + expanded study attempt modes.
--
-- Adds an assignments table (due dates, turn-in) and widens study_attempts.mode
-- so Write/Learn practice and assignment turn-ins all feed the XP leaderboard.

alter table study_attempts drop constraint if exists study_attempts_mode_check;
alter table study_attempts add constraint study_attempts_mode_check
  check (mode in ('quiz', 'match', 'review', 'write', 'learn', 'assignment'));

create table assignments (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  due_date     date not null,
  turned_in    boolean not null default false,
  turned_in_at timestamptz,
  created_by   uuid not null references auth.users on delete cascade,
  created_at   timestamptz default now()
);
create index assignments_due_idx on assignments (due_date);
alter table assignments enable row level security;

create policy "Couple members can read assignments" on assignments for select using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = assignments.created_by or c.user2_id = assignments.created_by)));
create policy "Users insert own assignments" on assignments for insert with check (auth.uid() = created_by);
create policy "Couple members can update assignments" on assignments for update using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = assignments.created_by or c.user2_id = assignments.created_by)));
create policy "Couple members can delete assignments" on assignments for delete using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = assignments.created_by or c.user2_id = assignments.created_by)));

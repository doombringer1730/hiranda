-- 051: Sealed predictions on the Grow map.
--
-- On a map stop with a prediction, each of you answers the question about
-- yourself (`mine`) and guesses what the other said (`guess`), as option
-- indexes. Your partner's answers stay sealed until you've answered too: the
-- read rule only shows their row once yours exists. Nothing is scored; the
-- app shows the two side by side.
--
-- answered_lesson() does the "have I answered?" check with owner rights, so
-- the read rule doesn't have to read this table from inside its own policy.
-- Answers can't be changed once given (no update or delete rule), like a
-- sealed note. Account deletion and couple deletion cascade.
--
-- Safe to re-run.

create table if not exists lesson_answers (
  couple_id   uuid not null references couple(id) on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  lesson_key  text not null check (char_length(lesson_key) <= 40),
  mine        smallint not null check (mine between 0 and 9),
  guess       smallint not null check (guess between 0 and 9),
  created_at  timestamptz not null default now(),
  primary key (user_id, lesson_key)
);
create index if not exists lesson_answers_couple_idx on lesson_answers (couple_id, lesson_key);
alter table lesson_answers enable row level security;

create or replace function public.answered_lesson(p_couple uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from lesson_answers a
     where a.user_id = auth.uid() and a.couple_id = p_couple and a.lesson_key = p_key
  )
$$;
revoke all on function public.answered_lesson(uuid, text) from public, anon;
grant execute on function public.answered_lesson(uuid, text) to authenticated;

drop policy if exists "Your answers, and theirs once you've answered" on lesson_answers;
create policy "Your answers, and theirs once you've answered" on lesson_answers for select to authenticated using (
  user_id = (select auth.uid())
  or (
    exists (select 1 from couple c where c.id = lesson_answers.couple_id
      and (c.user1_id = (select auth.uid()) or c.user2_id = (select auth.uid())))
    and public.answered_lesson(lesson_answers.couple_id, lesson_answers.lesson_key)
  )
);

drop policy if exists "Answer for yourself" on lesson_answers;
create policy "Answer for yourself" on lesson_answers for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from couple c where c.id = lesson_answers.couple_id
    and (c.user1_id = (select auth.uid()) or c.user2_id = (select auth.uid())))
);

-- Same 2FA rule as every other table (021).
drop policy if exists "Require 2FA when enabled" on lesson_answers;
create policy "Require 2FA when enabled" on lesson_answers as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- anon gets nothing (018).
revoke all on lesson_answers from anon;

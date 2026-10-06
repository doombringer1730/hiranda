-- 015: More games.
--
-- 1. board_games — live two-player turn-based games (Tic-Tac-Toe, Connect
--    Four, Dots & Boxes, Uno). One row per game; the board lives in `board` (jsonb)
--    and moves are validated by the server action in
--    src/app/(app)/games/board/actions.ts before being written.
--    `move_count` doubles as an optimistic lock so two quick taps can't both
--    land on the same turn.
--
-- 2. trivia_questions — "Trivia about us": each partner writes multiple-choice
--    questions about themselves; the other guesses once.
--
-- 3. "Who's more likely to…" — a new stock prompt type on the existing
--    blind-reveal prompts. Each partner picks one of the two of them; the
--    response stored is the chosen person's user id, so a match is still
--    plain string equality.
--
-- Safe to re-run: every statement is guarded, so running it twice (or after a
-- partial run) leaves the database in the same state.

create table if not exists board_games (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references couple on delete cascade,
  kind        text not null check (kind in ('tic_tac_toe','connect_four','dots_and_boxes','uno')),
  board       jsonb not null,
  player1     uuid not null references auth.users on delete cascade,
  player2     uuid not null references auth.users on delete cascade,
  turn        uuid references auth.users on delete cascade,
  status      text not null default 'active' check (status in ('active','won','draw')),
  winner      uuid references auth.users on delete cascade,
  move_count  integer not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists board_games_couple_kind_idx on board_games (couple_id, kind, created_at desc);
alter table board_games enable row level security;

drop policy if exists "Couple members can read board games" on board_games;
create policy "Couple members can read board games" on board_games for select using (
  exists (select 1 from couple c where c.id = board_games.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
drop policy if exists "Couple members can start board games" on board_games;
create policy "Couple members can start board games" on board_games for insert with check (
  exists (select 1 from couple c where c.id = board_games.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and board_games.player1 in (c.user1_id, c.user2_id)
    and board_games.player2 in (c.user1_id, c.user2_id)));
drop policy if exists "Couple members can update board games" on board_games;
create policy "Couple members can update board games" on board_games for update using (
  exists (select 1 from couple c where c.id = board_games.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

-- Live updates: the game screen subscribes to changes on its row.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'board_games') then
    alter publication supabase_realtime add table board_games;
  end if;
exception when duplicate_object then null;
end $$;


-- ── Trivia about us ──
create table if not exists trivia_questions (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null references auth.users on delete cascade,
  question    text not null,
  options     text[] not null check (array_length(options, 1) between 2 and 4),
  correct     integer not null check (correct >= 0 and correct < 4),
  guess       integer,
  guessed_at  timestamptz,
  created_at  timestamptz default now()
);
create index if not exists trivia_questions_author_idx on trivia_questions (author);
alter table trivia_questions enable row level security;

drop policy if exists "Couple members can read trivia" on trivia_questions;
create policy "Couple members can read trivia" on trivia_questions for select using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = trivia_questions.author or c.user2_id = trivia_questions.author)));
drop policy if exists "Users write their own trivia" on trivia_questions;
create policy "Users write their own trivia" on trivia_questions for insert with check (auth.uid() = author);
-- Guessing is an update by the partner; the server action only lets the
-- non-author set `guess`, and only once.
drop policy if exists "Couple members can update trivia" on trivia_questions;
create policy "Couple members can update trivia" on trivia_questions for update using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = trivia_questions.author or c.user2_id = trivia_questions.author)));
drop policy if exists "Authors can delete their trivia" on trivia_questions;
create policy "Authors can delete their trivia" on trivia_questions for delete using (auth.uid() = author);


-- ── Who's more likely to… ──
alter table prompts drop constraint if exists prompts_type_check;
alter table prompts add constraint prompts_type_check
  check (type in ('question','would_you_rather','this_or_that','most_likely'));

insert into prompts (type, text, is_stock)
select v.type, v.text, v.is_stock from (values
  ('most_likely', 'Who''s more likely to cry at a movie?', true),
  ('most_likely', 'Who''s more likely to get lost, even with GPS?', true),
  ('most_likely', 'Who''s more likely to eat the last slice without asking?', true),
  ('most_likely', 'Who''s more likely to fall asleep first on movie night?', true),
  ('most_likely', 'Who''s more likely to start a conversation with a stranger?', true),
  ('most_likely', 'Who''s more likely to forget an anniversary?', true),
  ('most_likely', 'Who''s more likely to plan the perfect date?', true),
  ('most_likely', 'Who''s more likely to adopt a pet on impulse?', true),
  ('most_likely', 'Who''s more likely to say "I told you so"?', true),
  ('most_likely', 'Who''s more likely to win an argument?', true),
  ('most_likely', 'Who''s more likely to apologize first?', true),
  ('most_likely', 'Who''s more likely to sing in the shower?', true),
  ('most_likely', 'Who''s more likely to binge a whole season in one night?', true),
  ('most_likely', 'Who''s more likely to be late?', true),
  ('most_likely', 'Who''s more likely to steal the blankets?', true),
  ('most_likely', 'Who''s more likely to go viral?', true),
  ('most_likely', 'Who''s more likely to cook something fancy?', true),
  ('most_likely', 'Who''s more likely to survive a zombie apocalypse?', true),
  ('most_likely', 'Who''s more likely to book a spontaneous trip?', true),
  ('most_likely', 'Who''s more likely to laugh at the wrong moment?', true),
  ('most_likely', 'Who''s more likely to text back instantly?', true),
  ('most_likely', 'Who''s more likely to keep a secret?', true),
  ('most_likely', 'Who''s more likely to cry at a wedding?', true),
  ('most_likely', 'Who''s more likely to buy something they don''t need?', true),
  ('most_likely', 'Who''s more likely to remember what we wore on our first date?', true),
  ('most_likely', 'Who''s more likely to talk to the dog like a person?', true),
  ('most_likely', 'Who''s more likely to hog the aux cord?', true),
  ('most_likely', 'Who''s more likely to get competitive over a board game?', true),
  ('most_likely', 'Who''s more likely to say "I love you" first in a day?', true),
  ('most_likely', 'Who''s more likely to have a snack hidden somewhere right now?', true),
  ('most_likely', 'Who''s more likely to become famous?', true),
  ('most_likely', 'Who''s more likely to rearrange the furniture at midnight?', true),
  ('most_likely', 'Who''s more likely to get scared during a horror movie?', true),
  ('most_likely', 'Who''s more likely to leave the dishes "to soak"?', true),
  ('most_likely', 'Who''s more likely to write a love letter?', true),
  ('most_likely', 'Who''s more likely to know every lyric to a song?', true)
) as v(type, text, is_stock)
where not exists (select 1 from prompts p where p.type = v.type and p.text = v.text);

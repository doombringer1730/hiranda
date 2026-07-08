-- 005: Study section — decks, cards, competitive attempts, spaced-repetition.
--
-- Couple-scoped like the rest of the app: a row is visible when the current
-- user and the row's owner (created_by / user_id) are both members of one
-- couple. Mirrors the bucket_list policy shape.

-- ── Decks ──
create table study_decks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  created_by  uuid not null references auth.users on delete cascade,
  created_at  timestamptz default now()
);
alter table study_decks enable row level security;

create policy "Couple members can read decks" on study_decks for select using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = study_decks.created_by or c.user2_id = study_decks.created_by)));
create policy "Users insert own decks" on study_decks for insert with check (auth.uid() = created_by);
create policy "Couple members can update decks" on study_decks for update using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = study_decks.created_by or c.user2_id = study_decks.created_by)));
create policy "Couple members can delete decks" on study_decks for delete using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = study_decks.created_by or c.user2_id = study_decks.created_by)));

-- ── Cards (scoped through their deck) ──
create table study_cards (
  id         uuid primary key default gen_random_uuid(),
  deck_id    uuid not null references study_decks on delete cascade,
  term       text not null,
  definition text not null,
  position   integer not null default 0,
  created_at timestamptz default now()
);
create index study_cards_deck_idx on study_cards (deck_id);
alter table study_cards enable row level security;

-- A card is accessible when its parent deck is accessible to the current user.
create policy "Couple members can read cards" on study_cards for select using (
  exists (select 1 from study_decks d join couple c
    on (c.user1_id = d.created_by or c.user2_id = d.created_by)
    where d.id = study_cards.deck_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
create policy "Couple members can write cards" on study_cards for all using (
  exists (select 1 from study_decks d join couple c
    on (c.user1_id = d.created_by or c.user2_id = d.created_by)
    where d.id = study_cards.deck_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())))
  with check (
  exists (select 1 from study_decks d join couple c
    on (c.user1_id = d.created_by or c.user2_id = d.created_by)
    where d.id = study_cards.deck_id and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

-- ── Attempts (competitive: quiz / match / review runs) ──
create table study_attempts (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid references study_decks on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  mode        text not null check (mode in ('quiz','match','review')),
  correct     integer not null default 0,
  total       integer not null default 0,
  xp          integer not null default 0,
  duration_ms integer,
  created_at  timestamptz default now()
);
create index study_attempts_user_idx on study_attempts (user_id, created_at);
alter table study_attempts enable row level security;

-- Read your own + your partner's (for the leaderboard / head-to-head).
create policy "Couple members can read attempts" on study_attempts for select using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = study_attempts.user_id or c.user2_id = study_attempts.user_id)));
create policy "Users insert own attempts" on study_attempts for insert with check (auth.uid() = user_id);

-- ── Spaced-repetition progress (per user, private) ──
create table study_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  card_id       uuid not null references study_cards on delete cascade,
  box           integer not null default 0,   -- Leitner box; higher = longer interval
  due_at        date not null default current_date,
  updated_at    timestamptz default now(),
  unique (user_id, card_id)
);
create index study_progress_user_idx on study_progress (user_id, due_at);
alter table study_progress enable row level security;

create policy "Users read own progress" on study_progress for select using (auth.uid() = user_id);
create policy "Users write own progress" on study_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

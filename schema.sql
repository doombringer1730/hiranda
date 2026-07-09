-- Hiranda Database Schema
-- Regenerated from the live database on 2026-07-04 to reflect reality.
--
-- IMPORTANT: Hiranda is multi-tenant. Each couple is a "space" (the `couple`
-- table), and every row is isolated to its couple via row-level security.
-- The isolation works by scoping each row through its creator's couple
-- membership: a row is visible only if EXISTS a couple where the current user
-- AND the row's creator (created_by / uploaded_by / added_by) are both members.
-- Do NOT replace these with `auth.role() = 'authenticated'` — that would make
-- the entire database world-readable to every signed-in user.
--
-- Tables live in the `public` schema and reference Supabase's `auth.users`.

-- ─────────────────────────────────────────
-- COUPLE (the tenant / "space")
-- ─────────────────────────────────────────

create table couple (
  id                  uuid primary key default gen_random_uuid(),
  user1_id            uuid not null unique references auth.users on delete cascade,
  user2_id            uuid unique references auth.users on delete cascade,
  together_since      date,
  show_timer          boolean default true,
  invite_token        text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at          timestamptz default now(),
  jellyfin_url        text,
  jellyfin_api_key    text,
  real_debrid_api_key text,
  torbox_api_key      text,
  theme               text not null default 'coffee'
);

alter table couple enable row level security;

create policy "User can create couple"
  on couple for insert with check (auth.uid() = user1_id);
create policy "Couple members can read their couple"
  on couple for select using ((auth.uid() = user1_id) or (auth.uid() = user2_id));
create policy "Members can update couple settings"
  on couple for update using ((auth.uid() = user1_id) or (auth.uid() = user2_id));

-- Invited partners claim the open slot via accept_invite() below (SECURITY
-- DEFINER, token-validated). Do NOT add an UPDATE policy for non-members:
-- migration 002 removed one that let any signed-in user claim any open couple.

create or replace function public.accept_invite(token text, new_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed int;
begin
  if auth.uid() is null or new_user_id is distinct from auth.uid() then
    return false;
  end if;

  update couple
     set user2_id = new_user_id
   where invite_token = accept_invite.token
     and user2_id is null
     and user1_id <> new_user_id;

  get diagnostics claimed = row_count;
  return claimed = 1;
exception
  when unique_violation then
    return false;
end;
$$;


-- ─────────────────────────────────────────
-- PROFILES (extends auth.users; holds Spotify tokens — keep scoped!)
-- ─────────────────────────────────────────

create table profiles (
  id                        uuid primary key references auth.users on delete cascade,
  display_name              text not null,
  avatar_url                text,
  created_at                timestamptz default now(),
  username                  text unique,
  spotify_access_token      text,
  spotify_refresh_token     text,
  spotify_token_expires_at  timestamptz,
  spotify_display_name      text,
  bio                       text,
  status_text               text,
  accent_color              text,   -- hex '#rrggbb'; profile accent + banner fallback gradient
  banner_url                text    -- public URL in the `banners` storage bucket (migration 004)
);

alter table profiles enable row level security;

-- Scoped to self + couple partner so Spotify tokens don't leak across couples.
create policy "Users in the same couple can read profiles"
  on profiles for select using (
    (id = auth.uid())
    or exists (
      select 1 from couple
      where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
        and ((couple.user1_id = profiles.id) or (couple.user2_id = profiles.id))
    )
  );
create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);


-- ─────────────────────────────────────────
-- MEMORIES
-- ─────────────────────────────────────────

create table memories (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text,
  happened_at   date not null default current_date,
  created_by    uuid not null references auth.users,
  tags          text[] default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  latitude      double precision,
  longitude     double precision,
  location_name text
);

alter table memories enable row level security;

create policy "Couple members can read memories"
  on memories for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = memories.created_by) or (couple.user2_id = memories.created_by))));
create policy "Users can insert their own memories"
  on memories for insert with check (auth.uid() = created_by);
create policy "Couple members can update memories"
  on memories for update using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = memories.created_by) or (couple.user2_id = memories.created_by))));
create policy "Couple members can delete memories"
  on memories for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = memories.created_by) or (couple.user2_id = memories.created_by))));


-- ─────────────────────────────────────────
-- PHOTOS (attached to memories; storage bucket: photos)
-- ─────────────────────────────────────────

create table photos (
  id           uuid primary key default gen_random_uuid(),
  memory_id    uuid not null references memories on delete cascade,
  storage_path text not null,
  caption      text,
  uploaded_by  uuid not null references auth.users,
  created_at   timestamptz default now()
);

alter table photos enable row level security;

create policy "Couple members can read photos"
  on photos for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = photos.uploaded_by) or (couple.user2_id = photos.uploaded_by))));
create policy "Users can insert their own photos"
  on photos for insert with check (auth.uid() = uploaded_by);
create policy "Couple members can delete photos"
  on photos for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = photos.uploaded_by) or (couple.user2_id = photos.uploaded_by))));


-- ─────────────────────────────────────────
-- JOURNAL ENTRIES
-- ─────────────────────────────────────────

create table journal_entries (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  body       text not null,
  mood       text check (mood in ('happy','loved','grateful','calm','anxious','sad','angry','excited')),
  tags       text[] default '{}',
  created_by uuid not null references auth.users,
  created_at timestamptz default now()
);

alter table journal_entries enable row level security;

create policy "Couple members can read journal entries"
  on journal_entries for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = journal_entries.created_by) or (couple.user2_id = journal_entries.created_by))));
create policy "Users can insert their own journal entries"
  on journal_entries for insert with check (auth.uid() = created_by);
create policy "Couple members can update journal entries"
  on journal_entries for update using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = journal_entries.created_by) or (couple.user2_id = journal_entries.created_by))));
create policy "Couple members can delete journal entries"
  on journal_entries for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = journal_entries.created_by) or (couple.user2_id = journal_entries.created_by))));


-- ─────────────────────────────────────────
-- JOURNAL PHOTOS (attached to journal entries)
-- ─────────────────────────────────────────

create table journal_photos (
  id               uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries on delete cascade,
  storage_path     text not null,
  uploaded_by      uuid not null references auth.users,
  created_at       timestamptz default now()
);

alter table journal_photos enable row level security;

create policy "Couple members can read journal photos"
  on journal_photos for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = journal_photos.uploaded_by) or (couple.user2_id = journal_photos.uploaded_by))));
create policy "Users can insert their own journal photos"
  on journal_photos for insert with check (auth.uid() = uploaded_by);
create policy "Couple members can delete journal photos"
  on journal_photos for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = journal_photos.uploaded_by) or (couple.user2_id = journal_photos.uploaded_by))));


-- ─────────────────────────────────────────
-- TODOS / CHORE LIST
-- ─────────────────────────────────────────

create table todos (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  completed   boolean default false,
  assigned_to uuid references auth.users,
  created_by  uuid not null references auth.users,
  created_at  timestamptz default now()
);

alter table todos enable row level security;

create policy "Couple members can read todos"
  on todos for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = todos.created_by) or (couple.user2_id = todos.created_by))));
create policy "Users can insert their own todos"
  on todos for insert with check (auth.uid() = created_by);
create policy "Couple members can update todos"
  on todos for update using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = todos.created_by) or (couple.user2_id = todos.created_by))));
create policy "Couple members can delete todos"
  on todos for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = todos.created_by) or (couple.user2_id = todos.created_by))));


-- ─────────────────────────────────────────
-- BUCKET LIST / GOALS
-- ─────────────────────────────────────────

create table bucket_list (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  category         text default 'other' check (category in ('travel','food','experience','other')),
  completed        boolean default false,
  completed_at     timestamptz,
  linked_memory_id uuid references memories,
  created_by       uuid not null references auth.users,
  created_at       timestamptz default now()
);

alter table bucket_list enable row level security;

create policy "Couple members can read bucket list"
  on bucket_list for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = bucket_list.created_by) or (couple.user2_id = bucket_list.created_by))));
create policy "Users can insert their own bucket list items"
  on bucket_list for insert with check (auth.uid() = created_by);
create policy "Couple members can update bucket list"
  on bucket_list for update using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = bucket_list.created_by) or (couple.user2_id = bucket_list.created_by))));
create policy "Couple members can delete bucket list"
  on bucket_list for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = bucket_list.created_by) or (couple.user2_id = bucket_list.created_by))));


-- ─────────────────────────────────────────
-- IMPORTANT DATES / ANNIVERSARIES
-- ─────────────────────────────────────────

create table important_dates (
  id               uuid primary key default gen_random_uuid(),
  label            text not null,
  date             date not null,
  recurring        boolean default true,
  note             text,
  linked_memory_id uuid references memories,
  created_by       uuid not null references auth.users,
  created_at       timestamptz default now()
);

alter table important_dates enable row level security;

create policy "Couple members can read dates"
  on important_dates for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = important_dates.created_by) or (couple.user2_id = important_dates.created_by))));
create policy "Users can insert their own dates"
  on important_dates for insert with check (auth.uid() = created_by);
create policy "Couple members can update dates"
  on important_dates for update using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = important_dates.created_by) or (couple.user2_id = important_dates.created_by))));
create policy "Couple members can delete dates"
  on important_dates for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = important_dates.created_by) or (couple.user2_id = important_dates.created_by))));


-- ─────────────────────────────────────────
-- MUSIC MOMENTS
-- ─────────────────────────────────────────

create table music_moments (
  id          uuid primary key default gen_random_uuid(),
  song_name   text not null,
  artist      text not null,
  spotify_url text,
  note        text,
  added_by    uuid not null references auth.users,
  created_at  timestamptz default now()
);

alter table music_moments enable row level security;

create policy "Couple members can read music moments"
  on music_moments for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = music_moments.added_by) or (couple.user2_id = music_moments.added_by))));
create policy "Users can insert their own music moments"
  on music_moments for insert with check (auth.uid() = added_by);
create policy "Users can delete their own music moments"
  on music_moments for delete using (auth.uid() = added_by);


-- ─────────────────────────────────────────
-- WATCHLIST
-- ─────────────────────────────────────────

create table watchlist (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  type       text default 'movie' check (type in ('movie','show')),
  note       text,
  watched    boolean default false,
  watched_at timestamptz,
  added_by   uuid not null references auth.users,
  created_at timestamptz default now()
);

alter table watchlist enable row level security;

create policy "Couple members can read watchlist"
  on watchlist for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = watchlist.added_by) or (couple.user2_id = watchlist.added_by))));
create policy "Users can insert their own watchlist items"
  on watchlist for insert with check (auth.uid() = added_by);
create policy "Couple members can update watchlist"
  on watchlist for update using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = watchlist.added_by) or (couple.user2_id = watchlist.added_by))));
create policy "Couple members can delete watchlist"
  on watchlist for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = watchlist.added_by) or (couple.user2_id = watchlist.added_by))));


-- ─────────────────────────────────────────
-- WATCH SESSIONS (synchronized viewing + streaming-site "party" mode)
-- ─────────────────────────────────────────

create table watch_sessions (
  id                        uuid primary key default gen_random_uuid(),
  title                     text not null,
  storage_path              text not null,
  state                     text default 'paused' check (state in ('paused','playing')),
  playback_position_seconds double precision default 0,
  last_updated_by           uuid references auth.users,
  updated_at                timestamptz default now(),
  created_by                uuid not null references auth.users,
  created_at                timestamptz default now(),
  source_type               text default 'upload' check (source_type in ('upload','url','local','party')),
  source_url                text,
  source_hint               text,
  fallback_urls             text[],
  thumbnail_url             text,
  platform                  text,
  party_url                 text,
  imdb_id                   text,
  subtitle_season           integer,
  subtitle_episode          integer
);

alter table watch_sessions enable row level security;

-- NOTE: party sessions are couple-private. A previous "Authenticated users can
-- read party sessions" policy leaked them across couples and was removed
-- (see migrations/001_fix_party_session_cross_couple_leak.sql).
create policy "Couple members can read watch sessions"
  on watch_sessions for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = watch_sessions.created_by) or (couple.user2_id = watch_sessions.created_by))));
create policy "Users can insert their own watch sessions"
  on watch_sessions for insert with check (auth.uid() = created_by);
create policy "Couple members can update watch sessions"
  on watch_sessions for update using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = watch_sessions.created_by) or (couple.user2_id = watch_sessions.created_by))));
create policy "Creator can update own watch session"
  on watch_sessions for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "Couple members can delete watch sessions"
  on watch_sessions for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = watch_sessions.created_by) or (couple.user2_id = watch_sessions.created_by))));


-- ─────────────────────────────────────────
-- WATCH MESSAGES (chat + emotes inside a watch session)
-- Scoped through the parent session's creator couple.
-- ─────────────────────────────────────────

create table watch_messages (
  id                     uuid primary key default gen_random_uuid(),
  session_id             uuid not null references watch_sessions on delete cascade,
  user_id                uuid not null references auth.users,
  body                   text,
  emote                  text,
  video_position_seconds double precision,
  created_at             timestamptz default now()
);

alter table watch_messages enable row level security;

create policy "Couple members can read watch messages"
  on watch_messages for select using (exists (
    select 1 from watch_sessions ws
    where ws.id = watch_messages.session_id and exists (
      select 1 from couple
      where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
        and ((couple.user1_id = ws.created_by) or (couple.user2_id = ws.created_by)))));
create policy "Couple members can insert watch messages"
  on watch_messages for insert with check ((auth.uid() = user_id) and exists (
    select 1 from watch_sessions ws
    where ws.id = watch_messages.session_id and exists (
      select 1 from couple
      where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
        and ((couple.user1_id = ws.created_by) or (couple.user2_id = ws.created_by)))));


-- ─────────────────────────────────────────
-- BOOKS (shared library; storage bucket for epubs)
-- ─────────────────────────────────────────

create table books (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  author      text,
  cover_path  text,
  epub_path   text not null,
  uploaded_by uuid not null references auth.users,
  created_at  timestamptz default now()
);

alter table books enable row level security;

create policy "Couple members can read books"
  on books for select using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = books.uploaded_by) or (couple.user2_id = books.uploaded_by))));
create policy "Users can insert their own books"
  on books for insert with check (auth.uid() = uploaded_by);
create policy "Couple members can delete books"
  on books for delete using (exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = books.uploaded_by) or (couple.user2_id = books.uploaded_by))));


-- ─────────────────────────────────────────
-- READING PROGRESS (per-user, per-book epub position)
-- ─────────────────────────────────────────

create table reading_progress (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references books on delete cascade,
  user_id    uuid not null references auth.users,
  cfi        text,
  updated_at timestamptz default now(),
  unique (book_id, user_id)
);

alter table reading_progress enable row level security;

create policy "Users can read their own progress"
  on reading_progress for select using (auth.uid() = user_id);
create policy "Users can upsert their own progress"
  on reading_progress for insert with check (auth.uid() = user_id);
create policy "Users can update their own progress"
  on reading_progress for update using (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- PROMPTS (daily questions — stock prompts are global; custom are per couple)
-- ─────────────────────────────────────────

create table prompts (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('question','would_you_rather','this_or_that')),
  text       text not null,
  option_a   text,
  option_b   text,
  is_stock   boolean default true,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

alter table prompts enable row level security;

create policy "Couple members can read prompts"
  on prompts for select using ((is_stock = true) or exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = prompts.created_by) or (couple.user2_id = prompts.created_by))));
create policy "Users can insert custom prompts"
  on prompts for insert with check (auth.uid() = created_by);


-- ─────────────────────────────────────────
-- PROMPT RESPONSES (blind-reveal answers; one per user per prompt)
-- ─────────────────────────────────────────

create table prompt_responses (
  id           uuid primary key default gen_random_uuid(),
  prompt_id    uuid not null references prompts on delete cascade,
  user_id      uuid not null references auth.users,
  response     text not null,
  responded_at timestamptz default now(),
  unique (prompt_id, user_id)
);

alter table prompt_responses enable row level security;

create policy "Couple members can read responses"
  on prompt_responses for select using ((user_id = auth.uid()) or exists (
    select 1 from couple
    where ((couple.user1_id = auth.uid()) or (couple.user2_id = auth.uid()))
      and ((couple.user1_id = prompt_responses.user_id) or (couple.user2_id = prompt_responses.user_id))));
create policy "Users can insert their own responses"
  on prompt_responses for insert with check (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- STUDY (decks, cards, competitive attempts, spaced-repetition) — migration 005
-- ─────────────────────────────────────────
-- study_decks, study_cards, study_attempts, study_progress.
-- Couple-scoped like bucket_list (via created_by / user_id sharing a couple);
-- study_progress is private per user. See migrations/005_study_section.sql for
-- the full table + policy definitions.
--
-- Migration 006: `assignments` table (due dates + turn-in, awards XP) and the
-- study_attempts.mode check widened to
-- ('quiz','match','review','write','learn','assignment').
-- Migration 007: study_attempts.coins (spendable currency, earned alongside XP)
-- and profiles.xp_goal (per-user weekly XP goal). Health is computed, not stored.


-- ─────────────────────────────────────────
-- STORAGE BUCKETS (create in the Supabase dashboard or via CLI)
-- ─────────────────────────────────────────

-- insert into storage.buckets (id, name, public) values ('photos', 'photos', false);
-- insert into storage.buckets (id, name, public) values ('videos', 'videos', false);
-- insert into storage.buckets (id, name, public) values ('journal', 'journal', false);
-- insert into storage.buckets (id, name, public) values ('books', 'books', false);

-- Hiranda database schema
-- Regenerated from the live database on 2026-10-16 (through migration 045).
--
-- This is the whole public schema in one place, grouped by feature: every
-- table with its columns, constraints, indexes and RLS policies, every
-- function, the grants, the realtime publication and the storage buckets.
-- migrations/ is still how changes reach the database; this file is the
-- map. When you add a migration, update the matching section here.
--
-- Sections are ordered so the file runs top to bottom on a fresh Supabase
-- project (a function or policy never refers to something defined later).
--
--   1. Setup ............... extensions, mfa_ok()
--   2. Couples & profiles .. couple, profiles, invites
--   3. Memories & journal .. memories, photos, journal_entries, journal_photos
--   4. Plans ............... todos, bucket_list, important_dates
--   5. Music & watchlist ... music_moments, watchlist
--   6. Theater ............. watch_sessions, watch_messages, watch_queue
--   7. Library ............. books, reading_progress
--   8. Prompts ............. prompts, prompt_responses, depth_optins, lovemap_reviews
--   9. Games ............... board_games, trivia_questions
--  10. Study ............... study_decks, study_cards, study_attempts,
--                            study_progress, assignments
--  11. Talk & letters ...... love_taps, messages, talk_sessions, letters,
--                            jar_slips, jar_settings, closeness_checkins
--  12. Grow ................ coupons, coupon_catalog, milestones,
--                            lesson_progress, trail_progress, trail_stamps
--  13. Notifications ....... push_subscriptions, native_push_tokens, notify_prefs
--  14. Plus ................ couple_plus, plus_trials, plus_intro_seen
--  15. Home ................ home_layouts, home_notes, feedback
--  16. Store ............... store_products, store_addresses, store_orders,
--                            gift_sizes, seller_applications
--  17. Account deletion .... purge_user_data()
--  18. Security ............ 2FA policy, anon lockout, table/column/function grants
--  19. Realtime ............ supabase_realtime publication
--  20. Storage ............. buckets and storage.objects policies
--  21. Migration log ....... what each file in migrations/ changed
--
-- HOW ISOLATION WORKS. Hiranda is multi-tenant: each couple is a "space" (the
-- `couple` table) and every row is isolated to its couple by row-level
-- security. Older tables are scoped through their creator: a row is visible
-- only if a couple exists where the current user AND the row's creator
-- (created_by / uploaded_by / added_by / user_id) are both members. Newer
-- tables carry couple_id and check membership of that couple directly.
-- Do NOT replace these with `auth.role() = 'authenticated'`: that would make
-- the whole database readable by every signed-in user.
--
-- On top of that, every table except the four listed in section 18 has a
-- restrictive "Require 2FA when enabled" policy, and the anon role has no
-- table access at all (migration 018).


-- ══════════════════════════════════════════════════════════════════════════
-- 1. SETUP
-- ══════════════════════════════════════════════════════════════════════════

-- Supabase installs these in the `extensions` schema, which is on the
-- default search_path (gen_random_bytes() comes from pgcrypto).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- True when the caller has passed 2FA, or has no verified factor to pass.
-- Used by the restrictive 2FA policy on every table (section 18) and checked
-- at the top of most security-definer functions below. Migration 021.
create or replace function public.mfa_ok()
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 2. COUPLES & PROFILES
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- couple
-- The tenant: one row per couple ("space"). user1 creates it; user2 joins
-- through accept_invite(). The app may UPDATE only the settings columns
-- granted in section 18, so membership, invite_token and paired_at can't
-- be rewritten from the client. Do NOT add an UPDATE policy for non-members:
-- migration 002 removed one that let any signed-in user claim any open couple.
-- theater_passcode_hash (011) gates the Theater UI; paired_at (045) is
-- stamped by accept_invite() and null for couples that paired before 045.
-- ──────────────────────────────────────────────────────────────────────────

create table couple (
  id                         uuid not null default gen_random_uuid(),
  user1_id                   uuid not null,
  user2_id                   uuid,
  together_since             date,
  show_timer                 boolean default true,
  invite_token               text not null default encode(gen_random_bytes(16), 'hex'::text),
  created_at                 timestamp with time zone default now(),
  jellyfin_url               text,
  jellyfin_api_key           text,
  real_debrid_api_key        text,
  torbox_api_key             text,
  theme                      text not null default 'coffee'::text,
  theater_passcode_hash      text,
  paired_at                  timestamp with time zone,
  constraint couple_pkey PRIMARY KEY (id),
  constraint couple_invite_token_key UNIQUE (invite_token),
  constraint couple_user1_id_key UNIQUE (user1_id),
  constraint couple_user2_id_key UNIQUE (user2_id),
  constraint couple_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint couple_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table couple enable row level security;

create policy "Couple members can read their couple"
  on couple for select
  using (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));
create policy "Users can read their own couple"
  on couple for select
  using (((user1_id = auth.uid()) OR (user2_id = auth.uid())));
create policy "User can create couple"
  on couple for insert
  with check (((auth.uid() = user1_id) AND (user2_id IS NULL) AND (paired_at IS NULL)));
create policy "Members can update couple settings"
  on couple for update
  using (((auth.uid() = user1_id) OR (auth.uid() = user2_id)))
  with check (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));

-- ──────────────────────────────────────────────────────────────────────────
-- profiles
-- Extends auth.users. Readable by yourself and your partner only. The
-- spotify_* token columns are never readable through the API: SELECT is
-- granted per column (section 18). A new column the app reads needs a
-- matching column grant.
-- ──────────────────────────────────────────────────────────────────────────

create table profiles (
  id                         uuid not null,
  display_name               text not null,
  avatar_url                 text,
  created_at                 timestamp with time zone default now(),
  username                   text,
  spotify_access_token       text,
  spotify_refresh_token      text,
  spotify_token_expires_at   timestamp with time zone,
  spotify_display_name       text,
  bio                        text,
  status_text                text,
  accent_color               text,
  banner_url                 text,
  xp_goal                    integer,
  activity                   text,
  activity_at                timestamp with time zone,
  time_zone                  text,
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_username_key UNIQUE (username),
  constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint profiles_time_zone_check CHECK ((char_length(time_zone) <= 64))
);

alter table profiles enable row level security;

create policy "Users in the same couple can read profiles"
  on profiles for select
  using (((id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = profiles.id) OR (couple.user2_id = profiles.id)))))));
create policy "Users can insert their own profile"
  on profiles for insert
  with check ((auth.uid() = id));
create policy "Users can update their own profile"
  on profiles for update
  using ((auth.uid() = id))
  with check ((auth.uid() = id));

-- Invited partners claim the open slot here (token-validated). An invitee
-- who already made an empty space of their own gives it up (014).
create or replace function public.accept_invite(token text, new_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  target_id uuid;
  claimed   int;
begin
  -- Callers may only claim a spot for themselves, and must be signed in.
  if auth.uid() is null or new_user_id is distinct from auth.uid() then
    return false;
  end if;

  -- Resolve the invite before discarding anything of the caller's.
  select id into target_id
    from couple
   where invite_token = accept_invite.token
     and user2_id is null
     and user1_id <> new_user_id;

  if target_id is null then
    return false;
  end if;

  begin
    delete from couple
     where user1_id = new_user_id
       and user2_id is null;

    update couple
       set user2_id = new_user_id,
           paired_at = now()
     where id = target_id
       and user2_id is null;

    get diagnostics claimed = row_count;
  exception
    -- user2_id is unique across couples: already partnered elsewhere. The
    -- handler rolls this block back, so the delete above is undone too.
    when unique_violation then
      return false;
  end;

  return claimed = 1;
end;
$$;

-- The inviter's first name, photo and colour for an unused invite link.
-- Callable signed out (anon), but needs the token. Migration 044.
create or replace function public.invite_preview(token text)
returns table(name text, avatar_url text, accent_color text)
language sql
stable security definer
set search_path = 'public'
as $$
  select nullif(split_part(trim(p.display_name), ' ', 1), ''), p.avatar_url, p.accent_color
    from couple c join profiles p on p.id = c.user1_id
   where c.invite_token = invite_preview.token and c.user2_id is null
   limit 1
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 3. MEMORIES & JOURNAL
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- memories
-- ──────────────────────────────────────────────────────────────────────────

create table memories (
  id                         uuid not null default gen_random_uuid(),
  title                      text not null,
  body                       text,
  happened_at                date not null default CURRENT_DATE,
  created_by                 uuid not null,
  tags                       text[] default '{}'::text[],
  created_at                 timestamp with time zone default now(),
  updated_at                 timestamp with time zone default now(),
  latitude                   double precision,
  longitude                  double precision,
  location_name              text,
  constraint memories_pkey PRIMARY KEY (id),
  constraint memories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

alter table memories enable row level security;

create policy "Couple members can read memories"
  on memories for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = memories.created_by) OR (couple.user2_id = memories.created_by))))));
create policy "Users can insert their own memories"
  on memories for insert
  with check ((auth.uid() = created_by));
create policy "Couple members can update memories"
  on memories for update
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = memories.created_by) OR (couple.user2_id = memories.created_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = memories.created_by) OR (couple.user2_id = memories.created_by))))));
create policy "Couple members can delete memories"
  on memories for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = memories.created_by) OR (couple.user2_id = memories.created_by))))));

-- ──────────────────────────────────────────────────────────────────────────
-- photos
-- Photos attached to a memory. Files live in the `photos` bucket.
-- ──────────────────────────────────────────────────────────────────────────

create table photos (
  id                         uuid not null default gen_random_uuid(),
  memory_id                  uuid not null,
  storage_path               text not null,
  caption                    text,
  uploaded_by                uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint photos_pkey PRIMARY KEY (id),
  constraint photos_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  constraint photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);

alter table photos enable row level security;

create policy "Couple members can read photos"
  on photos for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = photos.uploaded_by) OR (couple.user2_id = photos.uploaded_by))))));
create policy "Users can insert their own photos"
  on photos for insert
  with check ((auth.uid() = uploaded_by));
create policy "Couple members can delete photos"
  on photos for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = photos.uploaded_by) OR (couple.user2_id = photos.uploaded_by))))));

-- ──────────────────────────────────────────────────────────────────────────
-- journal_entries
-- ──────────────────────────────────────────────────────────────────────────

create table journal_entries (
  id                         uuid not null default gen_random_uuid(),
  title                      text,
  body                       text not null,
  mood                       text,
  tags                       text[] default '{}'::text[],
  created_by                 uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint journal_entries_pkey PRIMARY KEY (id),
  constraint journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  constraint journal_entries_mood_check CHECK ((mood = ANY (ARRAY['happy'::text, 'loved'::text, 'grateful'::text, 'calm'::text, 'anxious'::text, 'sad'::text, 'angry'::text, 'excited'::text])))
);

alter table journal_entries enable row level security;

create policy "Couple members can read journal entries"
  on journal_entries for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = journal_entries.created_by) OR (couple.user2_id = journal_entries.created_by))))));
create policy "Users can insert their own journal entries"
  on journal_entries for insert
  with check ((auth.uid() = created_by));
create policy "Couple members can update journal entries"
  on journal_entries for update
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = journal_entries.created_by) OR (couple.user2_id = journal_entries.created_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = journal_entries.created_by) OR (couple.user2_id = journal_entries.created_by))))));
create policy "Couple members can delete journal entries"
  on journal_entries for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = journal_entries.created_by) OR (couple.user2_id = journal_entries.created_by))))));

-- ──────────────────────────────────────────────────────────────────────────
-- journal_photos
-- Photos attached to a journal entry.
-- ──────────────────────────────────────────────────────────────────────────

create table journal_photos (
  id                         uuid not null default gen_random_uuid(),
  journal_entry_id           uuid not null,
  storage_path               text not null,
  uploaded_by                uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint journal_photos_pkey PRIMARY KEY (id),
  constraint journal_photos_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  constraint journal_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);

alter table journal_photos enable row level security;

create policy "Couple members can read journal photos"
  on journal_photos for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = journal_photos.uploaded_by) OR (couple.user2_id = journal_photos.uploaded_by))))));
create policy "Users can insert their own journal photos"
  on journal_photos for insert
  with check ((auth.uid() = uploaded_by));
create policy "Couple members can delete journal photos"
  on journal_photos for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = journal_photos.uploaded_by) OR (couple.user2_id = journal_photos.uploaded_by))))));


-- ══════════════════════════════════════════════════════════════════════════
-- 4. PLANS
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- todos
-- Shared to-do / chore list.
-- ──────────────────────────────────────────────────────────────────────────

create table todos (
  id                         uuid not null default gen_random_uuid(),
  text                       text not null,
  completed                  boolean default false,
  assigned_to                uuid,
  created_by                 uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint todos_pkey PRIMARY KEY (id),
  constraint todos_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id),
  constraint todos_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

alter table todos enable row level security;

create policy "Couple members can read todos"
  on todos for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = todos.created_by) OR (couple.user2_id = todos.created_by))))));
create policy "Users can insert their own todos"
  on todos for insert
  with check ((auth.uid() = created_by));
create policy "Couple members can update todos"
  on todos for update
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = todos.created_by) OR (couple.user2_id = todos.created_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = todos.created_by) OR (couple.user2_id = todos.created_by))))));
create policy "Couple members can delete todos"
  on todos for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = todos.created_by) OR (couple.user2_id = todos.created_by))))));

-- ──────────────────────────────────────────────────────────────────────────
-- bucket_list
-- Bucket list goals; can link to the memory that ticked one off.
-- ──────────────────────────────────────────────────────────────────────────

create table bucket_list (
  id                         uuid not null default gen_random_uuid(),
  title                      text not null,
  category                   text default 'other'::text,
  completed                  boolean default false,
  completed_at               timestamp with time zone,
  linked_memory_id           uuid,
  created_by                 uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint bucket_list_pkey PRIMARY KEY (id),
  constraint bucket_list_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  constraint bucket_list_linked_memory_id_fkey FOREIGN KEY (linked_memory_id) REFERENCES memories(id),
  constraint bucket_list_category_check CHECK ((category = ANY (ARRAY['travel'::text, 'food'::text, 'experience'::text, 'other'::text])))
);

alter table bucket_list enable row level security;

create policy "Couple members can read bucket list"
  on bucket_list for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = bucket_list.created_by) OR (couple.user2_id = bucket_list.created_by))))));
create policy "Users can insert their own bucket list items"
  on bucket_list for insert
  with check ((auth.uid() = created_by));
create policy "Couple members can update bucket list"
  on bucket_list for update
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = bucket_list.created_by) OR (couple.user2_id = bucket_list.created_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = bucket_list.created_by) OR (couple.user2_id = bucket_list.created_by))))));
create policy "Couple members can delete bucket list"
  on bucket_list for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = bucket_list.created_by) OR (couple.user2_id = bucket_list.created_by))))));

-- ──────────────────────────────────────────────────────────────────────────
-- important_dates
-- Anniversaries and other dates; recurring by default.
-- ──────────────────────────────────────────────────────────────────────────

create table important_dates (
  id                         uuid not null default gen_random_uuid(),
  label                      text not null,
  date                       date not null,
  recurring                  boolean default true,
  note                       text,
  linked_memory_id           uuid,
  created_by                 uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint important_dates_pkey PRIMARY KEY (id),
  constraint important_dates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  constraint important_dates_linked_memory_id_fkey FOREIGN KEY (linked_memory_id) REFERENCES memories(id)
);

alter table important_dates enable row level security;

create policy "Couple members can read dates"
  on important_dates for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = important_dates.created_by) OR (couple.user2_id = important_dates.created_by))))));
create policy "Users can insert their own dates"
  on important_dates for insert
  with check ((auth.uid() = created_by));
create policy "Couple members can update dates"
  on important_dates for update
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = important_dates.created_by) OR (couple.user2_id = important_dates.created_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = important_dates.created_by) OR (couple.user2_id = important_dates.created_by))))));
create policy "Couple members can delete dates"
  on important_dates for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = important_dates.created_by) OR (couple.user2_id = important_dates.created_by))))));


-- ══════════════════════════════════════════════════════════════════════════
-- 5. MUSIC & WATCHLIST
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- music_moments
-- ──────────────────────────────────────────────────────────────────────────

create table music_moments (
  id                         uuid not null default gen_random_uuid(),
  song_name                  text not null,
  artist                     text not null,
  spotify_url                text,
  note                       text,
  added_by                   uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint music_moments_pkey PRIMARY KEY (id),
  constraint music_moments_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id)
);

alter table music_moments enable row level security;

create policy "Couple members can read music moments"
  on music_moments for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = music_moments.added_by) OR (couple.user2_id = music_moments.added_by))))));
create policy "Users can insert their own music moments"
  on music_moments for insert
  with check ((auth.uid() = added_by));
create policy "Users can delete their own music moments"
  on music_moments for delete
  using ((auth.uid() = added_by));

-- ──────────────────────────────────────────────────────────────────────────
-- watchlist
-- Movies and shows to watch together.
-- ──────────────────────────────────────────────────────────────────────────

create table watchlist (
  id                         uuid not null default gen_random_uuid(),
  title                      text not null,
  type                       text default 'movie'::text,
  note                       text,
  watched                    boolean default false,
  watched_at                 timestamp with time zone,
  added_by                   uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint watchlist_pkey PRIMARY KEY (id),
  constraint watchlist_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id),
  constraint watchlist_type_check CHECK ((type = ANY (ARRAY['movie'::text, 'show'::text])))
);

alter table watchlist enable row level security;

create policy "Couple members can read watchlist"
  on watchlist for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = watchlist.added_by) OR (couple.user2_id = watchlist.added_by))))));
create policy "Users can insert their own watchlist items"
  on watchlist for insert
  with check ((auth.uid() = added_by));
create policy "Couple members can update watchlist"
  on watchlist for update
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = watchlist.added_by) OR (couple.user2_id = watchlist.added_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = watchlist.added_by) OR (couple.user2_id = watchlist.added_by))))));
create policy "Couple members can delete watchlist"
  on watchlist for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = watchlist.added_by) OR (couple.user2_id = watchlist.added_by))))));


-- ══════════════════════════════════════════════════════════════════════════
-- 6. THEATER
-- ══════════════════════════════════════════════════════════════════════════
-- Watch-together sync. App code lives in src/app/(theater)/ and src/theater/
-- (see src/theater/README.md). These tables are deliberately left out of the
-- 2FA policy (section 18).

-- ──────────────────────────────────────────────────────────────────────────
-- watch_sessions
-- One synchronized viewing (upload, url, local file, streaming-site "party",
-- or YouTube). Couple-private: a legacy policy that let any signed-in user
-- read party sessions leaked them across couples and was removed (001).
-- ──────────────────────────────────────────────────────────────────────────

create table watch_sessions (
  id                         uuid not null default gen_random_uuid(),
  title                      text not null,
  storage_path               text not null,
  state                      text default 'paused'::text,
  playback_position_seconds  double precision default 0,
  last_updated_by            uuid,
  updated_at                 timestamp with time zone default now(),
  created_by                 uuid not null,
  created_at                 timestamp with time zone default now(),
  source_type                text default 'upload'::text,
  source_url                 text,
  source_hint                text,
  fallback_urls              text[],
  thumbnail_url              text,
  platform                   text,
  party_url                  text,
  imdb_id                    text,
  subtitle_season            integer,
  subtitle_episode           integer,
  constraint watch_sessions_pkey PRIMARY KEY (id),
  constraint watch_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  constraint watch_sessions_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id),
  constraint watch_sessions_source_type_check CHECK ((source_type = ANY (ARRAY['upload'::text, 'url'::text, 'local'::text, 'party'::text, 'youtube'::text]))),
  constraint watch_sessions_state_check CHECK ((state = ANY (ARRAY['paused'::text, 'playing'::text])))
);

alter table watch_sessions enable row level security;

create policy "Couple members can read watch sessions"
  on watch_sessions for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = watch_sessions.created_by) OR (couple.user2_id = watch_sessions.created_by))))));
create policy "Users can insert their own watch sessions"
  on watch_sessions for insert
  with check ((auth.uid() = created_by));
create policy "Couple members can update watch sessions"
  on watch_sessions for update
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = watch_sessions.created_by) OR (couple.user2_id = watch_sessions.created_by))))));
create policy "Creator can update own watch session"
  on watch_sessions for update
  using ((auth.uid() = created_by))
  with check ((auth.uid() = created_by));
create policy "Couple members can delete watch sessions"
  on watch_sessions for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = watch_sessions.created_by) OR (couple.user2_id = watch_sessions.created_by))))));

-- ──────────────────────────────────────────────────────────────────────────
-- watch_messages
-- Chat and emotes inside a watch session, scoped through the parent
-- session's creator couple.
-- ──────────────────────────────────────────────────────────────────────────

create table watch_messages (
  id                         uuid not null default gen_random_uuid(),
  session_id                 uuid not null,
  user_id                    uuid not null,
  body                       text,
  emote                      text,
  video_position_seconds     double precision,
  created_at                 timestamp with time zone default now(),
  constraint watch_messages_pkey PRIMARY KEY (id),
  constraint watch_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES watch_sessions(id) ON DELETE CASCADE,
  constraint watch_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

alter table watch_messages enable row level security;

create policy "Couple members can read watch messages"
  on watch_messages for select
  using ((EXISTS ( SELECT 1
   FROM watch_sessions ws
  WHERE ((ws.id = watch_messages.session_id) AND (EXISTS ( SELECT 1
           FROM couple
          WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = ws.created_by) OR (couple.user2_id = ws.created_by)))))))));
create policy "Couple members can insert watch messages"
  on watch_messages for insert
  with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM watch_sessions ws
  WHERE ((ws.id = watch_messages.session_id) AND (EXISTS ( SELECT 1
           FROM couple
          WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = ws.created_by) OR (couple.user2_id = ws.created_by))))))))));

-- ──────────────────────────────────────────────────────────────────────────
-- watch_queue
-- "Up next" in the Theater, scoped like watch_messages. Migration 043.
-- ──────────────────────────────────────────────────────────────────────────

create table watch_queue (
  id                         uuid not null default gen_random_uuid(),
  session_id                 uuid not null,
  video_id                   text not null,
  title                      text not null,
  thumb                      text,
  duration                   integer,
  added_by                   uuid not null default auth.uid(),
  created_at                 timestamp with time zone not null default now(),
  played_at                  timestamp with time zone,
  constraint watch_queue_pkey PRIMARY KEY (id),
  constraint watch_queue_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint watch_queue_session_id_fkey FOREIGN KEY (session_id) REFERENCES watch_sessions(id) ON DELETE CASCADE,
  constraint watch_queue_thumb_check CHECK ((char_length(thumb) <= 500)),
  constraint watch_queue_title_check CHECK ((char_length(title) <= 200)),
  constraint watch_queue_video_id_check CHECK ((video_id ~ '^[A-Za-z0-9_-]{11}$'::text))
);

create index watch_queue_session_idx on watch_queue (session_id, created_at);

alter table watch_queue enable row level security;

create policy "Couple members see the queue"
  on watch_queue for select
  using ((EXISTS ( SELECT 1
   FROM (watch_sessions ws
     JOIN couple c ON (((c.user1_id = ws.created_by) OR (c.user2_id = ws.created_by))))
  WHERE ((ws.id = watch_queue.session_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Couple members add to the queue"
  on watch_queue for insert
  with check (((added_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (watch_sessions ws
     JOIN couple c ON (((c.user1_id = ws.created_by) OR (c.user2_id = ws.created_by))))
  WHERE ((ws.id = watch_queue.session_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Couple members play from the queue"
  on watch_queue for update
  using ((EXISTS ( SELECT 1
   FROM (watch_sessions ws
     JOIN couple c ON (((c.user1_id = ws.created_by) OR (c.user2_id = ws.created_by))))
  WHERE ((ws.id = watch_queue.session_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Couple members remove from the queue"
  on watch_queue for delete
  using ((EXISTS ( SELECT 1
   FROM (watch_sessions ws
     JOIN couple c ON (((c.user1_id = ws.created_by) OR (c.user2_id = ws.created_by))))
  WHERE ((ws.id = watch_queue.session_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));


-- ══════════════════════════════════════════════════════════════════════════
-- 7. LIBRARY
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- books
-- Shared epub library. Files live in the `epubs` bucket.
-- ──────────────────────────────────────────────────────────────────────────

create table books (
  id                         uuid not null default gen_random_uuid(),
  title                      text not null,
  author                     text,
  cover_path                 text,
  epub_path                  text not null,
  uploaded_by                uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint books_pkey PRIMARY KEY (id),
  constraint books_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);

alter table books enable row level security;

create policy "Couple members can read books"
  on books for select
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = books.uploaded_by) OR (couple.user2_id = books.uploaded_by))))));
create policy "Users can insert their own books"
  on books for insert
  with check ((auth.uid() = uploaded_by));
create policy "Couple members can delete books"
  on books for delete
  using ((EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = books.uploaded_by) OR (couple.user2_id = books.uploaded_by))))));

-- ──────────────────────────────────────────────────────────────────────────
-- reading_progress
-- Per-user, per-book epub position (CFI).
-- ──────────────────────────────────────────────────────────────────────────

create table reading_progress (
  id                         uuid not null default gen_random_uuid(),
  book_id                    uuid not null,
  user_id                    uuid not null,
  cfi                        text,
  updated_at                 timestamp with time zone default now(),
  constraint reading_progress_pkey PRIMARY KEY (id),
  constraint reading_progress_book_id_user_id_key UNIQUE (book_id, user_id),
  constraint reading_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  constraint reading_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

alter table reading_progress enable row level security;

create policy "Users can read their own progress"
  on reading_progress for select
  using ((auth.uid() = user_id));
create policy "Users can upsert their own progress"
  on reading_progress for insert
  with check ((auth.uid() = user_id));
create policy "Users can update their own progress"
  on reading_progress for update
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));


-- ══════════════════════════════════════════════════════════════════════════
-- 8. PROMPTS
-- ══════════════════════════════════════════════════════════════════════════
-- Daily questions. Stock prompts (is_stock) are global and seeded by the
-- migrations (015, 027, 038); custom prompts belong to a couple.

-- ──────────────────────────────────────────────────────────────────────────
-- prompts
-- depth 1-3 is how personal a question is (027); depth 4 is the After Dark
-- deck (038). A couple sees up to couple_depth(), and After Dark only when
-- couple_after_dark() says both opted in.
-- ──────────────────────────────────────────────────────────────────────────

create table prompts (
  id                         uuid not null default gen_random_uuid(),
  type                       text not null,
  text                       text not null,
  option_a                   text,
  option_b                   text,
  is_stock                   boolean default true,
  created_by                 uuid,
  created_at                 timestamp with time zone default now(),
  depth                      smallint not null default 1,
  constraint prompts_pkey PRIMARY KEY (id),
  constraint prompts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  constraint prompts_depth_check CHECK (((depth >= 1) AND (depth <= 4))),
  constraint prompts_type_check CHECK ((type = ANY (ARRAY['question'::text, 'would_you_rather'::text, 'this_or_that'::text, 'most_likely'::text])))
);

alter table prompts enable row level security;

create policy "Couple members can read prompts"
  on prompts for select
  using (((is_stock = true) OR (EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = prompts.created_by) OR (couple.user2_id = prompts.created_by)))))));
create policy "Users can insert custom prompts"
  on prompts for insert
  with check ((auth.uid() = created_by));

-- ──────────────────────────────────────────────────────────────────────────
-- prompt_responses
-- Blind-reveal answers: one per user per prompt.
-- ──────────────────────────────────────────────────────────────────────────

create table prompt_responses (
  id                         uuid not null default gen_random_uuid(),
  prompt_id                  uuid not null,
  user_id                    uuid not null,
  response                   text not null,
  responded_at               timestamp with time zone default now(),
  constraint prompt_responses_pkey PRIMARY KEY (id),
  constraint prompt_responses_prompt_id_user_id_key UNIQUE (prompt_id, user_id),
  constraint prompt_responses_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  constraint prompt_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

alter table prompt_responses enable row level security;

create policy "Couple members can read responses"
  on prompt_responses for select
  using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM couple
  WHERE (((couple.user1_id = auth.uid()) OR (couple.user2_id = auth.uid())) AND ((couple.user1_id = prompt_responses.user_id) OR (couple.user2_id = prompt_responses.user_id)))))));
create policy "Users can insert their own responses"
  on prompt_responses for insert
  with check ((auth.uid() = user_id));

-- ──────────────────────────────────────────────────────────────────────────
-- depth_optins
-- Each partner's chosen max depth and After Dark opt-in.
-- ──────────────────────────────────────────────────────────────────────────

create table depth_optins (
  couple_id                  uuid not null,
  user_id                    uuid not null,
  max_depth                  smallint not null default 1,
  updated_at                 timestamp with time zone not null default now(),
  after_dark                 boolean not null default false,
  constraint depth_optins_pkey PRIMARY KEY (user_id),
  constraint depth_optins_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint depth_optins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint depth_optins_max_depth_check CHECK (((max_depth >= 1) AND (max_depth <= 3)))
);

alter table depth_optins enable row level security;

create policy "Choose your own depth"
  on depth_optins for all
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = depth_optins.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Couple members see depth choices"
  on depth_optins for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = depth_optins.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

-- The depth both partners agreed to: the lower of the two opt-ins.
create or replace function public.couple_depth()
returns integer
language sql
stable security definer
set search_path = 'public'
as $$
  select coalesce(min(coalesce(o.max_depth, 1)), 1)::int
    from couple c
    cross join lateral (values (c.user1_id), (c.user2_id)) as m(uid)
    left join depth_optins o on o.user_id = m.uid
   where c.id = (select id from couple
                  where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
                  order by user2_id nulls last limit 1)
$$;

-- True only when both partners opted in to After Dark.
create or replace function public.couple_after_dark()
returns boolean
language sql
stable security definer
set search_path = 'public'
as $$
  select coalesce(bool_and(coalesce(o.after_dark, false)), false)
    from couple c
    cross join lateral (values (c.user1_id), (c.user2_id)) as m(uid)
    left join depth_optins o on o.user_id = m.uid
   where c.id = (select id from couple
                  where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
                  order by user2_id nulls last limit 1)
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- lovemap_reviews
-- Spaced-repetition boxes for "how well do you know me" answers (026).
-- ──────────────────────────────────────────────────────────────────────────

create table lovemap_reviews (
  user_id                    uuid not null,
  prompt_id                  uuid not null,
  box                        integer not null default 0,
  due_on                     date not null default CURRENT_DATE,
  updated_at                 timestamp with time zone not null default now(),
  constraint lovemap_reviews_pkey PRIMARY KEY (user_id, prompt_id),
  constraint lovemap_reviews_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  constraint lovemap_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint lovemap_reviews_box_check CHECK (((box >= 0) AND (box <= 6)))
);

alter table lovemap_reviews enable row level security;

create policy "Your own review boxes"
  on lovemap_reviews for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));


-- ══════════════════════════════════════════════════════════════════════════
-- 9. GAMES
-- ══════════════════════════════════════════════════════════════════════════
-- Migration 015. The 'most_likely' stock prompts are seeded there too.

-- ──────────────────────────────────────────────────────────────────────────
-- board_games
-- Live two-player games. Board state lives in `board` (jsonb); moves are
-- validated server-side by src/app/(app)/games/board/actions.ts, and
-- move_count is an optimistic lock.
-- ──────────────────────────────────────────────────────────────────────────

create table board_games (
  id                         uuid not null default gen_random_uuid(),
  couple_id                  uuid not null,
  kind                       text not null,
  board                      jsonb not null,
  player1                    uuid not null,
  player2                    uuid not null,
  turn                       uuid,
  status                     text not null default 'active'::text,
  winner                     uuid,
  move_count                 integer not null default 0,
  created_at                 timestamp with time zone default now(),
  updated_at                 timestamp with time zone default now(),
  constraint board_games_pkey PRIMARY KEY (id),
  constraint board_games_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint board_games_player1_fkey FOREIGN KEY (player1) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint board_games_player2_fkey FOREIGN KEY (player2) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint board_games_turn_fkey FOREIGN KEY (turn) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint board_games_winner_fkey FOREIGN KEY (winner) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint board_games_kind_check CHECK ((kind = ANY (ARRAY['tic_tac_toe'::text, 'connect_four'::text, 'dots_and_boxes'::text, 'uno'::text]))),
  constraint board_games_status_check CHECK ((status = ANY (ARRAY['active'::text, 'won'::text, 'draw'::text])))
);

create index board_games_couple_kind_idx on board_games (couple_id, kind, created_at DESC);

alter table board_games enable row level security;

create policy "Couple members can read board games"
  on board_games for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = board_games.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Couple members can start board games"
  on board_games for insert
  with check ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = board_games.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((board_games.player1 = c.user1_id) OR (board_games.player1 = c.user2_id)) AND ((board_games.player2 = c.user1_id) OR (board_games.player2 = c.user2_id))))));
create policy "Couple members can update board games"
  on board_games for update
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = board_games.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = board_games.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

-- ──────────────────────────────────────────────────────────────────────────
-- trivia_questions
-- Trivia about us: multiple-choice questions about yourself. Guessing is an
-- update by the partner; the server action only lets the non-author set
-- `guess`, and only once.
-- ──────────────────────────────────────────────────────────────────────────

create table trivia_questions (
  id                         uuid not null default gen_random_uuid(),
  author                     uuid not null,
  question                   text not null,
  options                    text[] not null,
  correct                    integer not null,
  guess                      integer,
  guessed_at                 timestamp with time zone,
  created_at                 timestamp with time zone default now(),
  constraint trivia_questions_pkey PRIMARY KEY (id),
  constraint trivia_questions_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint trivia_questions_correct_check CHECK (((correct >= 0) AND (correct < 4))),
  constraint trivia_questions_options_check CHECK (((array_length(options, 1) >= 2) AND (array_length(options, 1) <= 4)))
);

create index trivia_questions_author_idx on trivia_questions (author);

alter table trivia_questions enable row level security;

create policy "Couple members can read trivia"
  on trivia_questions for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = trivia_questions.author) OR (c.user2_id = trivia_questions.author))))));
create policy "Users write their own trivia"
  on trivia_questions for insert
  with check ((auth.uid() = author));
create policy "Couple members can update trivia"
  on trivia_questions for update
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = trivia_questions.author) OR (c.user2_id = trivia_questions.author))))))
  with check ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = trivia_questions.author) OR (c.user2_id = trivia_questions.author))))));
create policy "Authors can delete their trivia"
  on trivia_questions for delete
  using ((auth.uid() = author));


-- ══════════════════════════════════════════════════════════════════════════
-- 10. STUDY
-- ══════════════════════════════════════════════════════════════════════════
-- Migrations 005-009. Couple-scoped through created_by / user_id;
-- study_progress is private to each user.

-- ──────────────────────────────────────────────────────────────────────────
-- study_decks
-- ──────────────────────────────────────────────────────────────────────────

create table study_decks (
  id                         uuid not null default gen_random_uuid(),
  title                      text not null,
  description                text,
  created_by                 uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint study_decks_pkey PRIMARY KEY (id),
  constraint study_decks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table study_decks enable row level security;

create policy "Couple members can read decks"
  on study_decks for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = study_decks.created_by) OR (c.user2_id = study_decks.created_by))))));
create policy "Users insert own decks"
  on study_decks for insert
  with check ((auth.uid() = created_by));
create policy "Couple members can update decks"
  on study_decks for update
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = study_decks.created_by) OR (c.user2_id = study_decks.created_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = study_decks.created_by) OR (c.user2_id = study_decks.created_by))))));
create policy "Couple members can delete decks"
  on study_decks for delete
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = study_decks.created_by) OR (c.user2_id = study_decks.created_by))))));

-- ──────────────────────────────────────────────────────────────────────────
-- study_cards
-- ──────────────────────────────────────────────────────────────────────────

create table study_cards (
  id                         uuid not null default gen_random_uuid(),
  deck_id                    uuid not null,
  term                       text not null,
  definition                 text not null,
  "position"                 integer not null default 0,
  created_at                 timestamp with time zone default now(),
  constraint study_cards_pkey PRIMARY KEY (id),
  constraint study_cards_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES study_decks(id) ON DELETE CASCADE
);

create index study_cards_deck_idx on study_cards (deck_id);

alter table study_cards enable row level security;

create policy "Couple members can write cards"
  on study_cards for all
  using ((EXISTS ( SELECT 1
   FROM (study_decks d
     JOIN couple c ON (((c.user1_id = d.created_by) OR (c.user2_id = d.created_by))))
  WHERE ((d.id = study_cards.deck_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM (study_decks d
     JOIN couple c ON (((c.user1_id = d.created_by) OR (c.user2_id = d.created_by))))
  WHERE ((d.id = study_cards.deck_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Couple members can read cards"
  on study_cards for select
  using ((EXISTS ( SELECT 1
   FROM (study_decks d
     JOIN couple c ON (((c.user1_id = d.created_by) OR (c.user2_id = d.created_by))))
  WHERE ((d.id = study_cards.deck_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

-- ──────────────────────────────────────────────────────────────────────────
-- study_attempts
-- One practice run. xp only ever grows (drives leagues); coins are the
-- spendable currency earned alongside it (007).
-- ──────────────────────────────────────────────────────────────────────────

create table study_attempts (
  id                         uuid not null default gen_random_uuid(),
  deck_id                    uuid,
  user_id                    uuid not null,
  mode                       text not null,
  correct                    integer not null default 0,
  total                      integer not null default 0,
  xp                         integer not null default 0,
  duration_ms                integer,
  created_at                 timestamp with time zone default now(),
  coins                      integer not null default 0,
  constraint study_attempts_pkey PRIMARY KEY (id),
  constraint study_attempts_deck_id_fkey FOREIGN KEY (deck_id) REFERENCES study_decks(id) ON DELETE CASCADE,
  constraint study_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint study_attempts_mode_check CHECK ((mode = ANY (ARRAY['quiz'::text, 'match'::text, 'review'::text, 'write'::text, 'learn'::text, 'assignment'::text])))
);

create index study_attempts_user_idx on study_attempts (user_id, created_at);

alter table study_attempts enable row level security;

create policy "Couple members can read attempts"
  on study_attempts for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = study_attempts.user_id) OR (c.user2_id = study_attempts.user_id))))));
create policy "Users insert own attempts"
  on study_attempts for insert
  with check ((auth.uid() = user_id));

-- ──────────────────────────────────────────────────────────────────────────
-- study_progress
-- Spaced-repetition box per user per card.
-- ──────────────────────────────────────────────────────────────────────────

create table study_progress (
  id                         uuid not null default gen_random_uuid(),
  user_id                    uuid not null,
  card_id                    uuid not null,
  box                        integer not null default 0,
  due_at                     date not null default CURRENT_DATE,
  updated_at                 timestamp with time zone default now(),
  constraint study_progress_pkey PRIMARY KEY (id),
  constraint study_progress_user_id_card_id_key UNIQUE (user_id, card_id),
  constraint study_progress_card_id_fkey FOREIGN KEY (card_id) REFERENCES study_cards(id) ON DELETE CASCADE,
  constraint study_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create index study_progress_user_idx on study_progress (user_id, due_at);

alter table study_progress enable row level security;

create policy "Users write own progress"
  on study_progress for all
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "Users read own progress"
  on study_progress for select
  using ((auth.uid() = user_id));

-- ──────────────────────────────────────────────────────────────────────────
-- assignments
-- Due dates and turn-in. xp_awarded makes turn-in XP count once (009).
-- ──────────────────────────────────────────────────────────────────────────

create table assignments (
  id                         uuid not null default gen_random_uuid(),
  title                      text not null,
  due_date                   date not null,
  turned_in                  boolean not null default false,
  turned_in_at               timestamp with time zone,
  created_by                 uuid not null,
  created_at                 timestamp with time zone default now(),
  xp_awarded                 boolean not null default false,
  constraint assignments_pkey PRIMARY KEY (id),
  constraint assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

create index assignments_due_idx on assignments (due_date);

alter table assignments enable row level security;

create policy "Couple members can read assignments"
  on assignments for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = assignments.created_by) OR (c.user2_id = assignments.created_by))))));
create policy "Users insert own assignments"
  on assignments for insert
  with check ((auth.uid() = created_by));
create policy "Couple members can update assignments"
  on assignments for update
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = assignments.created_by) OR (c.user2_id = assignments.created_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = assignments.created_by) OR (c.user2_id = assignments.created_by))))));
create policy "Couple members can delete assignments"
  on assignments for delete
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = assignments.created_by) OR (c.user2_id = assignments.created_by))))));


-- ══════════════════════════════════════════════════════════════════════════
-- 11. TALK & LETTERS
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- love_taps
-- "Thinking of you" taps. Partner-readable; you insert your own (017).
-- ──────────────────────────────────────────────────────────────────────────

create table love_taps (
  id                         uuid not null default gen_random_uuid(),
  from_user                  uuid not null,
  created_at                 timestamp with time zone default now(),
  constraint love_taps_pkey PRIMARY KEY (id),
  constraint love_taps_from_user_fkey FOREIGN KEY (from_user) REFERENCES auth.users(id) ON DELETE CASCADE
);

create index love_taps_from_idx on love_taps (from_user, created_at DESC);

alter table love_taps enable row level security;

create policy "Couple members can read love taps"
  on love_taps for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = love_taps.from_user) OR (c.user2_id = love_taps.from_user))))));
create policy "Users send their own love taps"
  on love_taps for insert
  with check ((auth.uid() = from_user));

-- ──────────────────────────────────────────────────────────────────────────
-- messages
-- Couple chat (024). Senders insert and unsend; recipients may only set
-- reaction / read_at (column grants, section 18). 'urgent' messages are
-- limited to 3 a day by the limit_urgent trigger (027).
-- ──────────────────────────────────────────────────────────────────────────

create table messages (
  id                         uuid not null default gen_random_uuid(),
  couple_id                  uuid not null,
  sender                     uuid not null,
  kind                       text not null default 'text'::text,
  body                       text not null,
  reaction                   text,
  read_at                    timestamp with time zone,
  created_at                 timestamp with time zone not null default now(),
  constraint messages_pkey PRIMARY KEY (id),
  constraint messages_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint messages_sender_fkey FOREIGN KEY (sender) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 4000))),
  constraint messages_kind_check CHECK ((kind = ANY (ARRAY['text'::text, 'good_news'::text, 'urgent'::text]))),
  constraint messages_reaction_check CHECK ((reaction = ANY (ARRAY['❤️'::text, '😂'::text, '😮'::text, '😢'::text, '👍'::text, '🔥'::text])))
);

create index messages_couple_idx on messages (couple_id, created_at DESC);

alter table messages enable row level security;

create policy "Couple members can read messages"
  on messages for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = messages.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Couple members send messages"
  on messages for insert
  with check (((sender = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = messages.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Recipients react and mark read"
  on messages for update
  using (((sender <> auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = messages.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Senders unsend their own messages"
  on messages for delete
  using ((sender = auth.uid()));

create or replace function public.limit_urgent()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if new.kind = 'urgent' and (
    select count(*) from messages
     where sender = new.sender and kind = 'urgent' and created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'urgent_limit' using hint = 'Urgent messages are limited to 3 a day.';
  end if;
  return new;
end;
$$;

create trigger messages_limit_urgent
  before insert on messages
  for each row execute function limit_urgent();

-- ──────────────────────────────────────────────────────────────────────────
-- talk_sessions
-- Shared talk-time countdowns (023).
-- ──────────────────────────────────────────────────────────────────────────

create table talk_sessions (
  id                         uuid not null default gen_random_uuid(),
  couple_id                  uuid not null,
  started_by                 uuid not null,
  minutes                    integer not null,
  started_at                 timestamp with time zone not null default now(),
  ended_at                   timestamp with time zone,
  completed                  boolean not null default false,
  constraint talk_sessions_pkey PRIMARY KEY (id),
  constraint talk_sessions_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint talk_sessions_started_by_fkey FOREIGN KEY (started_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint talk_sessions_minutes_check CHECK (((minutes >= 1) AND (minutes <= 180)))
);

create index talk_sessions_couple_idx on talk_sessions (couple_id, started_at DESC);

alter table talk_sessions enable row level security;

create policy "Couple members can read talk sessions"
  on talk_sessions for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = talk_sessions.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Couple members start talk sessions"
  on talk_sessions for insert
  with check (((started_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = talk_sessions.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Couple members update talk sessions"
  on talk_sessions for update
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = talk_sessions.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

-- ──────────────────────────────────────────────────────────────────────────
-- letters
-- Letters, optionally sealed until unlock_at (025). The body column is not
-- readable through the API; read_letter() returns it once it may be opened.
-- ──────────────────────────────────────────────────────────────────────────

create table letters (
  id                         uuid not null default gen_random_uuid(),
  couple_id                  uuid not null,
  author                     uuid not null,
  recipient                  uuid not null,
  open_when                  text,
  title                      text,
  body                       text not null,
  unlock_at                  timestamp with time zone,
  opened_at                  timestamp with time zone,
  created_at                 timestamp with time zone not null default now(),
  constraint letters_pkey PRIMARY KEY (id),
  constraint letters_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint letters_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint letters_recipient_fkey FOREIGN KEY (recipient) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint letters_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 20000))),
  constraint letters_check CHECK ((author <> recipient)),
  constraint letters_open_when_check CHECK ((char_length(open_when) <= 80)),
  constraint letters_title_check CHECK ((char_length(title) <= 120))
);

create index letters_couple_idx on letters (couple_id, created_at DESC);

alter table letters enable row level security;

create policy "Couple members see letter envelopes"
  on letters for select
  using ((((author = auth.uid()) OR (recipient = auth.uid())) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = letters.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Write letters to your partner"
  on letters for insert
  with check (((author = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = letters.couple_id) AND (((c.user1_id = auth.uid()) AND (c.user2_id = letters.recipient)) OR ((c.user2_id = auth.uid()) AND (c.user1_id = letters.recipient))))))));
create policy "Authors take back their letters"
  on letters for delete
  using ((author = auth.uid()));

create or replace function public.read_letter(p_id uuid)
returns table(body text, opened_at timestamp with time zone)
language plpgsql
security definer
set search_path = 'public'
as $$
declare l letters;
begin
  if not public.mfa_ok() then return; end if;
  select * into l from letters where id = p_id;
  if not found then return; end if;
  if l.author = auth.uid() then
    return query select l.body, l.opened_at;
  elsif l.recipient = auth.uid() and (l.unlock_at is null or l.unlock_at <= now()) then
    if l.opened_at is null then
      update letters set opened_at = now() where id = p_id returning letters.opened_at into l.opened_at;
    end if;
    return query select l.body, l.opened_at;
  end if;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- jar_slips
-- Two jars (025): 'ours' (date ideas, drawn in pairs by draw_from_jar())
-- and 'thanks' (gratitude, opened together on jar_settings.thanks_open_on).
-- Bodies are only readable through jar_slips_for().
-- ──────────────────────────────────────────────────────────────────────────

create table jar_slips (
  id                         uuid not null default gen_random_uuid(),
  couple_id                  uuid not null,
  jar                        text not null,
  author                     uuid not null,
  body                       text not null,
  drawn_at                   timestamp with time zone,
  created_at                 timestamp with time zone not null default now(),
  constraint jar_slips_pkey PRIMARY KEY (id),
  constraint jar_slips_author_fkey FOREIGN KEY (author) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint jar_slips_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint jar_slips_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 500))),
  constraint jar_slips_jar_check CHECK ((jar = ANY (ARRAY['ours'::text, 'thanks'::text])))
);

create index jar_slips_couple_idx on jar_slips (couple_id, jar, created_at DESC);

alter table jar_slips enable row level security;

create policy "Couple members see jar slips"
  on jar_slips for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = jar_slips.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Add your own slips"
  on jar_slips for insert
  with check (((author = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = jar_slips.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Take back your own undrawn slips"
  on jar_slips for delete
  using (((author = auth.uid()) AND (drawn_at IS NULL)));

-- ──────────────────────────────────────────────────────────────────────────
-- jar_settings
-- ──────────────────────────────────────────────────────────────────────────

create table jar_settings (
  couple_id                  uuid not null,
  thanks_open_on             date,
  constraint jar_settings_pkey PRIMARY KEY (couple_id),
  constraint jar_settings_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE
);

alter table jar_settings enable row level security;

create policy "Couple members manage jar settings"
  on jar_settings for all
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = jar_settings.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = jar_settings.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

create or replace function public.jar_slips_for(p_jar text)
returns table(id uuid, author uuid, body text, drawn_at timestamp with time zone, created_at timestamp with time zone)
language sql
stable security definer
set search_path = 'public'
as $$
  select s.id, s.author,
         case when s.author = auth.uid()
                or (s.jar = 'ours' and s.drawn_at is not null)
                or (s.jar = 'thanks' and js.thanks_open_on is not null
                    and js.thanks_open_on <= current_date
                    and s.created_at < (js.thanks_open_on + 1)::timestamptz)
              then s.body end,
         s.drawn_at, s.created_at
    from jar_slips s
    join couple c on c.id = s.couple_id
    left join jar_settings js on js.couple_id = s.couple_id
   where s.jar = p_jar
     and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
     and public.mfa_ok()
   order by s.created_at desc;
$$;

create or replace function public.draw_from_jar()
returns table(id uuid, author uuid, body text)
language plpgsql
security definer
set search_path = 'public'
as $$
declare c couple; a uuid; b uuid;
begin
  if not public.mfa_ok() then return; end if;
  select * into c from couple
   where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
   order by user2_id nulls last limit 1;
  if not found then return; end if;
  select s.id into a from jar_slips s where s.couple_id = c.id and s.jar = 'ours' and s.drawn_at is null and s.author = c.user1_id order by random() limit 1 for update skip locked;
  select s.id into b from jar_slips s where s.couple_id = c.id and s.jar = 'ours' and s.drawn_at is null and s.author = c.user2_id order by random() limit 1 for update skip locked;
  if a is null or b is null then return; end if;
  update jar_slips set drawn_at = now() where jar_slips.id in (a, b);
  return query select s.id, s.author, s.body from jar_slips s where s.id in (a, b);
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- closeness_checkins
-- How close you feel, 1-5. Private to you (038).
-- ──────────────────────────────────────────────────────────────────────────

create table closeness_checkins (
  id                         uuid not null default gen_random_uuid(),
  user_id                    uuid not null,
  couple_id                  uuid not null,
  score                      smallint not null,
  created_at                 timestamp with time zone not null default now(),
  constraint closeness_checkins_pkey PRIMARY KEY (id),
  constraint closeness_checkins_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint closeness_checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint closeness_checkins_score_check CHECK (((score >= 1) AND (score <= 5)))
);

create index closeness_checkins_user_idx on closeness_checkins (user_id, created_at DESC);

alter table closeness_checkins enable row level security;

create policy "Only you see your check-ins"
  on closeness_checkins for select
  using ((user_id = auth.uid()));
create policy "Check in for yourself"
  on closeness_checkins for insert
  with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = closeness_checkins.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Remove your own check-ins"
  on closeness_checkins for delete
  using ((user_id = auth.uid()));


-- ══════════════════════════════════════════════════════════════════════════
-- 12. GROW
-- ══════════════════════════════════════════════════════════════════════════
-- Rewards (026, 038). Coupons are created only by functions: given by a
-- partner (give_coupon), or earned from milestones and trails.

-- ──────────────────────────────────────────────────────────────────────────
-- coupon_catalog
-- The pool reward coupons are drawn from, by rarity. Seeded by 026.
-- ──────────────────────────────────────────────────────────────────────────

create table coupon_catalog (
  id                         serial,
  rarity                     text not null,
  emoji                      text not null,
  title                      text not null,
  constraint coupon_catalog_pkey PRIMARY KEY (id),
  constraint coupon_catalog_title_key UNIQUE (title),
  constraint coupon_catalog_rarity_check CHECK ((rarity = ANY (ARRAY['common'::text, 'rare'::text, 'legendary'::text])))
);

alter table coupon_catalog enable row level security;

create policy "Anyone signed in can read the catalog"
  on coupon_catalog for select to authenticated
  using (true);

-- ──────────────────────────────────────────────────────────────────────────
-- coupons
-- A coupon held by bought_by (the partner who gets to redeem it). Clients
-- may only set the redeemed / revealed / done columns (section 18).
-- ──────────────────────────────────────────────────────────────────────────

create table coupons (
  id                         uuid not null default gen_random_uuid(),
  title                      text not null,
  emoji                      text,
  cost                       integer not null default 0,
  bought_by                  uuid not null,
  redeemed                   boolean not null default false,
  redeemed_at                timestamp with time zone,
  created_at                 timestamp with time zone default now(),
  rarity                     text not null default 'common'::text,
  source                     text not null default 'gift'::text,
  given_by                   uuid,
  revealed_at                timestamp with time zone,
  done_at                    timestamp with time zone,
  constraint coupons_pkey PRIMARY KEY (id),
  constraint coupons_bought_by_fkey FOREIGN KEY (bought_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint coupons_given_by_fkey FOREIGN KEY (given_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint coupons_rarity_check CHECK ((rarity = ANY (ARRAY['gift'::text, 'common'::text, 'rare'::text, 'legendary'::text])))
);

create index coupons_buyer_idx on coupons (bought_by);

alter table coupons enable row level security;

create policy "Couple members can read coupons"
  on coupons for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = coupons.bought_by) OR (c.user2_id = coupons.bought_by))))));
create policy "Couple members can update coupons"
  on coupons for update
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = coupons.bought_by) OR (c.user2_id = coupons.bought_by))))))
  with check ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = coupons.bought_by) OR (c.user2_id = coupons.bought_by))))));
create policy "Couple members can delete coupons"
  on coupons for delete
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = coupons.bought_by) OR (c.user2_id = coupons.bought_by))))));

create or replace function public.give_coupon(p_title text, p_emoji text)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare c couple; partner uuid; new_id uuid;
begin
  if not public.mfa_ok() then return null; end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 80 then return null; end if;
  select * into c from couple
   where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
   order by user2_id nulls last limit 1;
  if not found then return null; end if;
  partner := case when c.user1_id = auth.uid() then c.user2_id else c.user1_id end;
  insert into coupons (title, emoji, cost, bought_by, rarity, source, given_by)
  values (trim(p_title), left(coalesce(nullif(trim(p_emoji), ''), '🎁'), 8), 0, partner, 'gift', 'gift', auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- milestones
-- Milestones a couple has earned. Written only by award_milestones().
-- ──────────────────────────────────────────────────────────────────────────

create table milestones (
  couple_id                  uuid not null,
  key                        text not null,
  earned_at                  timestamp with time zone not null default now(),
  constraint milestones_pkey PRIMARY KEY (couple_id, key),
  constraint milestones_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE
);

alter table milestones enable row level security;

create policy "Couple members see their passport"
  on milestones for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = milestones.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

-- ──────────────────────────────────────────────────────────────────────────
-- lesson_progress
-- Lessons each partner finished, with an optional note.
-- ──────────────────────────────────────────────────────────────────────────

create table lesson_progress (
  couple_id                  uuid not null,
  user_id                    uuid not null,
  lesson_key                 text not null,
  note                       text,
  completed_at               timestamp with time zone not null default now(),
  constraint lesson_progress_pkey PRIMARY KEY (user_id, lesson_key),
  constraint lesson_progress_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint lesson_progress_lesson_key_check CHECK ((char_length(lesson_key) <= 40)),
  constraint lesson_progress_note_check CHECK ((char_length(note) <= 1000))
);

create index lesson_progress_couple_idx on lesson_progress (couple_id);

alter table lesson_progress enable row level security;

create policy "Couple members see lesson progress"
  on lesson_progress for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = lesson_progress.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Complete your own lessons"
  on lesson_progress for insert
  with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = lesson_progress.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Edit your own lesson notes"
  on lesson_progress for update
  using ((user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- trail_progress
-- Days of a 5-day trail each partner has done (038).
-- ──────────────────────────────────────────────────────────────────────────

create table trail_progress (
  couple_id                  uuid not null,
  user_id                    uuid not null,
  trail_key                  text not null,
  day                        smallint not null,
  note                       text,
  completed_at               timestamp with time zone not null default now(),
  constraint trail_progress_pkey PRIMARY KEY (user_id, trail_key, day),
  constraint trail_progress_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint trail_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint trail_progress_day_check CHECK (((day >= 1) AND (day <= 7))),
  constraint trail_progress_note_check CHECK ((char_length(note) <= 1000)),
  constraint trail_progress_trail_key_check CHECK ((char_length(trail_key) <= 24))
);

create index trail_progress_couple_idx on trail_progress (couple_id, trail_key);

alter table trail_progress enable row level security;

create policy "Couple members see trail progress"
  on trail_progress for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = trail_progress.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Finish your own trail days"
  on trail_progress for insert
  with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = trail_progress.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Edit your own trail notes"
  on trail_progress for update
  using ((user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- trail_stamps
-- Trails a couple finished together. Written only by finish_trail().
-- ──────────────────────────────────────────────────────────────────────────

create table trail_stamps (
  couple_id                  uuid not null,
  trail_key                  text not null,
  earned_at                  timestamp with time zone not null default now(),
  constraint trail_stamps_pkey PRIMARY KEY (couple_id, trail_key),
  constraint trail_stamps_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint trail_stamps_trail_key_check CHECK ((char_length(trail_key) <= 24))
);

alter table trail_stamps enable row level security;

create policy "Couple members see trail stamps"
  on trail_stamps for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = trail_stamps.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

-- Every milestone: its track, the threshold, and the coupon rarity it pays.
create or replace function public.milestone_defs()
returns table(key text, track text, threshold integer, rarity text)
language sql
 IMMUTABLE
as $$
  values
    ('talk_1', 'talk', 1, 'common'), ('talk_5', 'talk', 5, 'common'), ('talk_20', 'talk', 20, 'rare'), ('talk_50', 'talk', 50, 'legendary'),
    ('know_10', 'know', 10, 'common'), ('know_50', 'know', 50, 'rare'), ('know_150', 'know', 150, 'legendary'),
    ('letters_1', 'letters', 1, 'common'), ('letters_5', 'letters', 5, 'rare'),
    ('thanks_5', 'thanks', 5, 'common'), ('thanks_25', 'thanks', 25, 'rare'),
    ('jar_1', 'jar', 1, 'common'), ('jar_5', 'jar', 5, 'rare'), ('jar_15', 'jar', 15, 'legendary'),
    ('memories_10', 'memories', 10, 'common'), ('memories_50', 'memories', 50, 'rare'), ('memories_100', 'memories', 100, 'legendary'),
    ('weeks_4', 'weeks', 4, 'common'), ('weeks_12', 'weeks', 12, 'rare'), ('weeks_52', 'weeks', 52, 'legendary'),
    ('path_4', 'path', 4, 'common'), ('path_12', 'path', 12, 'rare'), ('path_20', 'path', 20, 'legendary')
$$;

-- The couple's current value on each milestone track.
create or replace function public.milestone_progress()
returns table(track text, value integer)
language plpgsql
stable security definer
set search_path = 'public'
as $$
declare c couple; a uuid; b uuid;
begin
  if not public.mfa_ok() then return; end if;
  select * into c from couple
   where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
   order by user2_id nulls last limit 1;
  if not found then return; end if;
  a := c.user1_id; b := c.user2_id;
  return query
  select 'talk', (select count(*)::int from talk_sessions t where t.couple_id = c.id
                    and (t.completed or (t.ended_at is null and t.started_at + make_interval(mins => t.minutes) <= now())))
  union all
  select 'know', (select count(*)::int from (select r.prompt_id from prompt_responses r where r.user_id in (a, b)
                    group by r.prompt_id having count(distinct r.user_id) = 2) x)
  union all
  select 'letters', (select count(*)::int from letters l where l.couple_id = c.id)
  union all
  select 'thanks', (select count(*)::int from jar_slips s where s.couple_id = c.id and s.jar = 'thanks')
  union all
  select 'jar', (select count(distinct date_trunc('second', s.drawn_at))::int from jar_slips s
                   where s.couple_id = c.id and s.jar = 'ours' and s.drawn_at is not null)
  union all
  select 'memories', (select count(*)::int from memories m where m.created_by in (a, b))
  union all
  select 'path', (select count(*)::int from (select p.lesson_key from lesson_progress p where p.couple_id = c.id
                    group by p.lesson_key having count(distinct p.user_id) = 2) x)
  union all
  -- Good weeks: weeks with 4+ days where you BOTH showed up (or talked together).
  select 'weeks', (
    with acts as (
      select j.created_by u, j.created_at::date d from journal_entries j where j.created_by in (a, b)
      union all select m.created_by, m.created_at::date from memories m where m.created_by in (a, b)
      union all select r.user_id, r.responded_at::date from prompt_responses r where r.user_id in (a, b)
      union all select g.sender, g.created_at::date from messages g where g.couple_id = c.id
      union all select l.from_user, l.created_at::date from love_taps l where l.from_user in (a, b)
    ), days as (
      select d from acts group by d having count(distinct u) = 2
      union select t.started_at::date from talk_sessions t where t.couple_id = c.id and t.completed
    )
    select count(*)::int from (select date_trunc('week', d) from days group by 1 having count(*) >= 4) w);
end;
$$;

-- Records newly reached milestones and gives each partner a coupon.
create or replace function public.award_milestones()
returns table(key text)
language plpgsql
security definer
set search_path = 'public'
as $$
declare c couple; d record; got int; pick record; who uuid;
begin
  if not public.mfa_ok() then return; end if;
  select * into c from couple
   where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
   order by user2_id nulls last limit 1;
  if not found then return; end if;

  for d in
    select m.key, m.rarity from public.milestone_defs() m
      join public.milestone_progress() p on p.track = m.track
     where p.value >= m.threshold
       and not exists (select 1 from milestones x where x.couple_id = c.id and x.key = m.key)
  loop
    insert into milestones (couple_id, key) values (c.id, d.key) on conflict do nothing;
    get diagnostics got = row_count;
    if got > 0 then
      foreach who in array array[c.user1_id, c.user2_id] loop
        select * into pick from coupon_catalog where rarity = d.rarity order by random() limit 1;
        insert into coupons (title, emoji, cost, bought_by, rarity, source)
        values (pick.title, pick.emoji, 0, who, d.rarity, 'milestone:' || d.key);
      end loop;
      key := d.key;
      return next;
    end if;
  end loop;
end;
$$;

-- Stamps a trail once both partners did every day, and gives each a rare coupon.
create or replace function public.finish_trail(p_trail text)
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $$
declare c couple; days int := 5; got int; pick record; who uuid;
begin
  if not public.mfa_ok() then return false; end if;
  if p_trail not in ('money', 'love', 'distance', 'home', 'family', 'repair') then return false; end if;
  select * into c from couple
   where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
   order by user2_id nulls last limit 1;
  if not found then return false; end if;
  if (select count(*) from trail_progress t
       where t.couple_id = c.id and t.trail_key = p_trail and t.day between 1 and days
         and t.user_id in (c.user1_id, c.user2_id)) < days * 2 then
    return false;
  end if;
  insert into trail_stamps (couple_id, trail_key) values (c.id, p_trail) on conflict do nothing;
  get diagnostics got = row_count;
  if got = 0 then return false; end if;
  foreach who in array array[c.user1_id, c.user2_id] loop
    select * into pick from coupon_catalog where rarity = 'rare' order by random() limit 1;
    insert into coupons (title, emoji, cost, bought_by, rarity, source)
    values (pick.title, pick.emoji, 0, who, 'rare', 'trail:' || p_trail);
  end loop;
  return true;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 13. NOTIFICATIONS
-- ══════════════════════════════════════════════════════════════════════════
-- Each user manages only their own devices. The server reaches a partner's
-- devices only through the security-definer partner_* / prune_partner_*
-- functions.

-- ──────────────────────────────────────────────────────────────────────────
-- push_subscriptions
-- Web push: one row per browser that opted in (016). `private` hides the
-- details on the lock screen (022).
-- ──────────────────────────────────────────────────────────────────────────

create table push_subscriptions (
  id                         uuid not null default gen_random_uuid(),
  user_id                    uuid not null,
  endpoint                   text not null,
  p256dh                     text not null,
  auth                       text not null,
  created_at                 timestamp with time zone default now(),
  private                    boolean not null default false,
  constraint push_subscriptions_pkey PRIMARY KEY (id),
  constraint push_subscriptions_endpoint_key UNIQUE (endpoint),
  constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "Users read their own push subscriptions"
  on push_subscriptions for select
  using ((auth.uid() = user_id));
create policy "Users add their own push subscriptions"
  on push_subscriptions for insert
  with check ((auth.uid() = user_id));
create policy "Users update their own push subscriptions"
  on push_subscriptions for update
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "Users remove their own push subscriptions"
  on push_subscriptions for delete
  using ((auth.uid() = user_id));

create or replace function public.partner_push_subscriptions()
returns table(endpoint text, p256dh text, auth text, private boolean)
language sql
stable security definer
set search_path = 'public'
as $$
  select s.endpoint, s.p256dh, s.auth, s.private
  from push_subscriptions s
  join couple c on (c.user1_id = auth.uid() and s.user_id = c.user2_id)
                or (c.user2_id = auth.uid() and s.user_id = c.user1_id);
$$;

create or replace function public.prune_partner_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = 'public'
as $$
  delete from push_subscriptions s
  using couple c
  where s.endpoint = p_endpoint
    and ((c.user1_id = auth.uid() and s.user_id = c.user2_id)
      or (c.user2_id = auth.uid() and s.user_id = c.user1_id));
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- native_push_tokens
-- APNs device tokens from the iOS app (028).
-- ──────────────────────────────────────────────────────────────────────────

create table native_push_tokens (
  token                      text not null,
  user_id                    uuid not null,
  platform                   text not null default 'ios'::text,
  created_at                 timestamp with time zone not null default now(),
  updated_at                 timestamp with time zone not null default now(),
  constraint native_push_tokens_pkey PRIMARY KEY (token),
  constraint native_push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint native_push_tokens_platform_check CHECK ((platform = 'ios'::text)),
  constraint native_push_tokens_token_check CHECK ((token ~ '^[0-9a-f]{64,200}$'::text))
);

create index native_push_tokens_user on native_push_tokens (user_id);

alter table native_push_tokens enable row level security;

create policy "Users read their own native push tokens"
  on native_push_tokens for select
  using ((auth.uid() = user_id));
create policy "Users remove their own native push tokens"
  on native_push_tokens for delete
  using ((auth.uid() = user_id));

create or replace function public.register_native_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.mfa_ok() then raise exception 'mfa required'; end if;
  if p_token !~ '^[0-9a-f]{64,200}$' then raise exception 'bad token'; end if;
  delete from native_push_tokens where token = p_token and user_id <> auth.uid();
  insert into native_push_tokens (token, user_id) values (p_token, auth.uid())
    on conflict (token) do update set updated_at = now();
end;
$$;

create or replace function public.partner_native_push_tokens()
returns table(token text)
language sql
stable security definer
set search_path = 'public'
as $$
  select t.token
    from native_push_tokens t
    join couple c on (c.user1_id = auth.uid() and c.user2_id = t.user_id)
                  or (c.user2_id = auth.uid() and c.user1_id = t.user_id)
$$;

create or replace function public.prune_partner_native_push_token(p_token text)
returns void
language sql
security definer
set search_path = 'public'
as $$
  delete from native_push_tokens t
   using couple c
   where t.token = p_token
     and ((c.user1_id = auth.uid() and c.user2_id = t.user_id)
       or (c.user2_id = auth.uid() and c.user1_id = t.user_id))
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- notify_prefs
-- Do Not Disturb and quiet hours (minutes after midnight, in tz) (027).
-- ──────────────────────────────────────────────────────────────────────────

create table notify_prefs (
  user_id                    uuid not null,
  dnd_until                  timestamp with time zone,
  quiet_start                smallint,
  quiet_end                  smallint,
  tz                         text,
  updated_at                 timestamp with time zone not null default now(),
  constraint notify_prefs_pkey PRIMARY KEY (user_id),
  constraint notify_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint notify_prefs_quiet_end_check CHECK (((quiet_end >= 0) AND (quiet_end <= 1439))),
  constraint notify_prefs_quiet_start_check CHECK (((quiet_start >= 0) AND (quiet_start <= 1439))),
  constraint notify_prefs_tz_check CHECK ((char_length(tz) <= 64))
);

alter table notify_prefs enable row level security;

create policy "Your own quiet settings"
  on notify_prefs for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "Your partner can see when you're quiet"
  on notify_prefs for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) AND (c.user2_id = notify_prefs.user_id)) OR ((c.user2_id = auth.uid()) AND (c.user1_id = notify_prefs.user_id))))));


-- ══════════════════════════════════════════════════════════════════════════
-- 14. PLUS
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- couple_plus
-- The couple's Plus entitlement (029). Written only by the payment webhooks
-- and admin grants (service role).
-- ──────────────────────────────────────────────────────────────────────────

create table couple_plus (
  couple_id                  uuid not null,
  source                     text not null,
  status                     text not null default 'active'::text,
  product                    text,
  current_period_end         timestamp with time zone,
  external_id                text,
  updated_at                 timestamp with time zone not null default now(),
  constraint couple_plus_pkey PRIMARY KEY (couple_id),
  constraint couple_plus_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint couple_plus_source_check CHECK ((source = ANY (ARRAY['apple'::text, 'stripe'::text, 'grant'::text]))),
  constraint couple_plus_status_check CHECK ((status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text, 'canceled'::text, 'expired'::text])))
);

alter table couple_plus enable row level security;

create policy "Couple members see their Plus"
  on couple_plus for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = couple_plus.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

-- ──────────────────────────────────────────────────────────────────────────
-- plus_trials
-- One free week per couple (039).
-- ──────────────────────────────────────────────────────────────────────────

create table plus_trials (
  couple_id                  uuid not null,
  started_by                 uuid,
  started_at                 timestamp with time zone not null default now(),
  ends_at                    timestamp with time zone not null,
  constraint plus_trials_pkey PRIMARY KEY (couple_id),
  constraint plus_trials_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint plus_trials_started_by_fkey FOREIGN KEY (started_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table plus_trials enable row level security;

create policy "Couple members see their trial"
  on plus_trials for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = plus_trials.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));

-- ──────────────────────────────────────────────────────────────────────────
-- plus_intro_seen
-- Whether a user has seen the Plus intro.
-- ──────────────────────────────────────────────────────────────────────────

create table plus_intro_seen (
  user_id                    uuid not null,
  seen_at                    timestamp with time zone not null default now(),
  constraint plus_intro_seen_pkey PRIMARY KEY (user_id),
  constraint plus_intro_seen_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table plus_intro_seen enable row level security;

create policy "Your own intro"
  on plus_intro_seen for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- Active (or past-due, within the period) subscription, or a running trial.
create or replace function public.couple_has_plus()
returns boolean
language sql
stable security definer
set search_path = 'public'
as $$
  select exists (
    select 1
      from couple_plus p
      join couple c on c.id = p.couple_id
     where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
       and p.status in ('active', 'trialing', 'past_due')
       and (p.current_period_end is null or p.current_period_end > now())
  ) or exists (
    select 1
      from plus_trials t
      join couple c on c.id = t.couple_id
     where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
       and t.ends_at > now()
  )
$$;

create or replace function public.start_plus_trial()
returns timestamp with time zone
language plpgsql
security definer
set search_path = 'public'
as $$
declare c couple; ends timestamptz;
begin
  if not public.mfa_ok() then return null; end if;
  select * into c from couple
   where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
   order by user2_id nulls last limit 1;
  if not found then return null; end if;
  if public.couple_has_plus() then return null; end if;
  insert into plus_trials (couple_id, started_by, ends_at)
  values (c.id, auth.uid(), now() + interval '7 days')
  on conflict (couple_id) do nothing
  returning ends_at into ends;
  return ends;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 15. HOME
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- home_layouts
-- The couple's Home card layout. Saving needs Plus (040).
-- ──────────────────────────────────────────────────────────────────────────

create table home_layouts (
  couple_id                  uuid not null,
  layout                     jsonb not null,
  updated_by                 uuid,
  updated_at                 timestamp with time zone not null default now(),
  constraint home_layouts_pkey PRIMARY KEY (couple_id),
  constraint home_layouts_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint home_layouts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint home_layouts_layout_check CHECK (((jsonb_typeof(layout) = 'array'::text) AND (jsonb_array_length(layout) <= 40)))
);

alter table home_layouts enable row level security;

create policy "Couple members see their home"
  on home_layouts for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = home_layouts.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Couple members set up their home"
  on home_layouts for insert
  with check (((updated_by = auth.uid()) AND couple_has_plus() AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = home_layouts.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Couple members rearrange their home"
  on home_layouts for update
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = home_layouts.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))))
  with check (((updated_by = auth.uid()) AND couple_has_plus() AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = home_layouts.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));

-- ──────────────────────────────────────────────────────────────────────────
-- home_notes
-- The shared note on Home (040).
-- ──────────────────────────────────────────────────────────────────────────

create table home_notes (
  couple_id                  uuid not null,
  body                       text not null default ''::text,
  updated_by                 uuid,
  updated_at                 timestamp with time zone not null default now(),
  constraint home_notes_pkey PRIMARY KEY (couple_id),
  constraint home_notes_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint home_notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint home_notes_body_check CHECK ((char_length(body) <= 280))
);

alter table home_notes enable row level security;

create policy "Couple members read their note"
  on home_notes for select
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = home_notes.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))));
create policy "Couple members start their note"
  on home_notes for insert
  with check (((updated_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = home_notes.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));
create policy "Couple members write on their note"
  on home_notes for update
  using ((EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = home_notes.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))))
  with check (((updated_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = home_notes.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())))))));

-- ──────────────────────────────────────────────────────────────────────────
-- feedback
-- Answers to the "Enjoying Hiranda?" card. Only you see yours (042).
-- ──────────────────────────────────────────────────────────────────────────

create table feedback (
  id                         uuid not null default gen_random_uuid(),
  user_id                    uuid not null default auth.uid(),
  couple_id                  uuid,
  rating                     smallint,
  note                       text,
  created_at                 timestamp with time zone not null default now(),
  constraint feedback_pkey PRIMARY KEY (id),
  constraint feedback_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE SET NULL,
  constraint feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint feedback_note_check CHECK ((char_length(note) <= 1000)),
  constraint feedback_rating_check CHECK (((rating >= 1) AND (rating <= 3)))
);

create index feedback_user_idx on feedback (user_id, created_at DESC);

alter table feedback enable row level security;

create policy "You see your own feedback"
  on feedback for select
  using ((user_id = auth.uid()));
create policy "You give feedback"
  on feedback for insert
  with check (((user_id = auth.uid()) AND ((couple_id IS NULL) OR (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = feedback.couple_id) AND ((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid()))))))));
create policy "You add a note to your feedback"
  on feedback for update
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));


-- ══════════════════════════════════════════════════════════════════════════
-- 16. STORE
-- ══════════════════════════════════════════════════════════════════════════
-- Gifts sent to your partner (030-041). Orders start as 'pending' and the
-- server moves them on; vendor fields are server-set.

-- ──────────────────────────────────────────────────────────────────────────
-- store_products
-- Admin-added products (034). Server only: RLS on, no policies.
-- ──────────────────────────────────────────────────────────────────────────

create table store_products (
  key                        text not null,
  title                      text not null,
  blurb                      text not null default ''::text,
  image_url                  text,
  emoji                      text not null default '🎁'::text,
  category                   text not null default 'gift'::text,
  price_cents                integer not null,
  cost_cents                 integer,
  vendor                     jsonb not null,
  delivery                   text,
  source_ref                 text,
  active                     boolean not null default true,
  sort                       integer not null default 0,
  created_at                 timestamp with time zone not null default now(),
  updated_at                 timestamp with time zone not null default now(),
  options                    jsonb,
  constraint store_products_pkey PRIMARY KEY (key),
  constraint store_products_blurb_check CHECK ((char_length(blurb) <= 300)),
  constraint store_products_category_check CHECK ((category = ANY (ARRAY['her'::text, 'him'::text, 'cuddly'::text, 'jewelry'::text, 'cozy'::text, 'gift'::text, 'keepsake'::text]))),
  constraint store_products_cost_cents_check CHECK ((cost_cents >= 0)),
  constraint store_products_delivery_check CHECK ((char_length(delivery) <= 80)),
  constraint store_products_emoji_check CHECK ((char_length(emoji) <= 16)),
  constraint store_products_image_url_check CHECK (((image_url ~ '^https://'::text) AND (char_length(image_url) <= 500))),
  constraint store_products_key_check CHECK ((key ~ '^[a-z0-9][a-z0-9-]{1,59}$'::text)),
  constraint store_products_price_cents_check CHECK (((price_cents >= 100) AND (price_cents <= 100000))),
  constraint store_products_source_ref_check CHECK ((char_length(source_ref) <= 120)),
  constraint store_products_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120)))
);

create index store_products_active on store_products (active, category, sort);

alter table store_products enable row level security;

-- ──────────────────────────────────────────────────────────────────────────
-- store_addresses
-- Your shipping address. Owner-only; your partner never sees it.
-- ──────────────────────────────────────────────────────────────────────────

create table store_addresses (
  user_id                    uuid not null,
  full_name                  text not null,
  line1                      text not null,
  line2                      text,
  city                       text not null,
  region                     text,
  postal_code                text not null,
  country                    text not null default 'US'::text,
  phone                      text,
  updated_at                 timestamp with time zone not null default now(),
  constraint store_addresses_pkey PRIMARY KEY (user_id),
  constraint store_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint store_addresses_city_check CHECK (((char_length(city) >= 1) AND (char_length(city) <= 120))),
  constraint store_addresses_country_check CHECK ((country ~ '^[A-Z]{2}$'::text)),
  constraint store_addresses_full_name_check CHECK (((char_length(full_name) >= 1) AND (char_length(full_name) <= 120))),
  constraint store_addresses_line1_check CHECK (((char_length(line1) >= 1) AND (char_length(line1) <= 200))),
  constraint store_addresses_line2_check CHECK ((char_length(line2) <= 200)),
  constraint store_addresses_phone_check CHECK ((char_length(phone) <= 40)),
  constraint store_addresses_postal_code_check CHECK (((char_length(postal_code) >= 1) AND (char_length(postal_code) <= 20))),
  constraint store_addresses_region_check CHECK ((char_length(region) <= 120))
);

alter table store_addresses enable row level security;

create policy "Your own gift address"
  on store_addresses for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- gift_sizes
-- Your clothing sizes, so your partner can send clothes (037).
-- ──────────────────────────────────────────────────────────────────────────

create table gift_sizes (
  user_id                    uuid not null,
  top                        text,
  bottom                     text,
  shoe                       text,
  updated_at                 timestamp with time zone not null default now(),
  constraint gift_sizes_pkey PRIMARY KEY (user_id),
  constraint gift_sizes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint gift_sizes_bottom_check CHECK ((char_length(bottom) <= 10)),
  constraint gift_sizes_shoe_check CHECK ((char_length(shoe) <= 10)),
  constraint gift_sizes_top_check CHECK ((char_length(top) <= 10))
);

alter table gift_sizes enable row level security;

create policy "Your own sizes"
  on gift_sizes for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- store_orders
-- photos (041) lists the photo ids to print, in order, for Polaroid prints
-- and photo books; the server re-checks they belong to the couple.
-- ──────────────────────────────────────────────────────────────────────────

create table store_orders (
  id                         uuid not null default gen_random_uuid(),
  couple_id                  uuid not null,
  sender_id                  uuid not null,
  recipient_id               uuid not null,
  product_key                text not null,
  title                      text not null,
  note                       text,
  amount_cents               integer not null,
  currency                   text not null default 'usd'::text,
  status                     text not null default 'pending'::text,
  stripe_session_id          text,
  tracking_url               text,
  created_at                 timestamp with time zone not null default now(),
  updated_at                 timestamp with time zone not null default now(),
  vendor                     text,
  vendor_order_id            text,
  vendor_error               text,
  option                     text,
  photos                     uuid[],
  constraint store_orders_pkey PRIMARY KEY (id),
  constraint store_orders_stripe_session_id_key UNIQUE (stripe_session_id),
  constraint store_orders_couple_id_fkey FOREIGN KEY (couple_id) REFERENCES couple(id) ON DELETE CASCADE,
  constraint store_orders_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint store_orders_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint store_orders_amount_cents_check CHECK ((amount_cents > 0)),
  constraint store_orders_currency_check CHECK ((currency ~ '^[a-z]{3}$'::text)),
  constraint store_orders_note_check CHECK ((char_length(note) <= 300)),
  constraint store_orders_option_check CHECK ((char_length(option) <= 60)),
  constraint store_orders_photos_check CHECK (((photos IS NULL) OR ((cardinality(photos) >= 1) AND (cardinality(photos) <= 200)))),
  constraint store_orders_product_key_check CHECK ((char_length(product_key) <= 60)),
  constraint store_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'fulfilling'::text, 'shipped'::text, 'delivered'::text, 'canceled'::text, 'refunded'::text]))),
  constraint store_orders_title_check CHECK ((char_length(title) <= 120)),
  constraint store_orders_tracking_url_check CHECK ((char_length(tracking_url) <= 500)),
  constraint store_orders_vendor_check CHECK ((vendor = ANY (ARRAY['gelato'::text, 'printful'::text, 'printify'::text, 'cj'::text, 'goody'::text]))),
  constraint store_orders_vendor_error_check CHECK ((char_length(vendor_error) <= 500)),
  constraint store_orders_vendor_order_id_check CHECK ((char_length(vendor_order_id) <= 120))
);

create index store_orders_couple on store_orders (couple_id, created_at DESC);
create unique index store_orders_vendor_ref on store_orders (vendor, vendor_order_id) WHERE (vendor_order_id IS NOT NULL);

alter table store_orders enable row level security;

create policy "Senders see their gifts"
  on store_orders for select
  using ((sender_id = auth.uid()));
create policy "Start a gift for your partner"
  on store_orders for insert
  with check (((sender_id = auth.uid()) AND (status = 'pending'::text) AND (stripe_session_id IS NULL) AND (tracking_url IS NULL) AND (vendor IS NULL) AND (vendor_order_id IS NULL) AND (vendor_error IS NULL) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE ((c.id = store_orders.couple_id) AND (((c.user1_id = auth.uid()) AND (c.user2_id = store_orders.recipient_id)) OR ((c.user2_id = auth.uid()) AND (c.user1_id = store_orders.recipient_id))))))));

-- Whether your partner saved an address, without revealing it.
create or replace function public.partner_has_gift_address()
returns boolean
language sql
stable security definer
set search_path = 'public'
as $$
  select exists (
    select 1 from store_addresses a
      join couple c on (c.user1_id = auth.uid() and c.user2_id = a.user_id)
                    or (c.user2_id = auth.uid() and c.user1_id = a.user_id)
  )
$$;

-- Which sizes your partner saved (top / bottom / shoe), not the sizes.
create or replace function public.partner_size_kinds()
returns text[]
language sql
stable security definer
set search_path = 'public'
as $$
  select coalesce((
    select array_remove(array[
        case when s.top is not null then 'top' end,
        case when s.bottom is not null then 'bottom' end,
        case when s.shoe is not null then 'shoe' end], null)
      from gift_sizes s
      join couple c on (c.user1_id = auth.uid() and c.user2_id = s.user_id)
                    or (c.user2_id = auth.uid() and c.user1_id = s.user_id)
      limit 1), '{}')
$$;

-- Gifts on their way to you, without the price.
create or replace function public.incoming_gifts()
returns table(id uuid, sender_id uuid, title text, note text, status text, tracking_url text, created_at timestamp with time zone)
language sql
stable security definer
set search_path = 'public'
as $$
  select o.id, o.sender_id, o.title, o.note, o.status, o.tracking_url, o.created_at
    from store_orders o
   where o.recipient_id = auth.uid()
     and o.status in ('paid', 'fulfilling', 'shipped', 'delivered')
   order by o.created_at desc
   limit 20
$$;

-- The recipient marks a gift delivered (031).
create or replace function public.confirm_gift_arrived(p_order uuid)
returns void
language sql
security definer
set search_path = 'public'
as $$
  update store_orders set status = 'delivered', updated_at = now()
   where id = p_order and recipient_id = auth.uid()
     and status in ('paid', 'fulfilling', 'shipped')
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- seller_applications
-- "Sell on Hiranda" applications (033). Server only: RLS on, no policies.
-- ──────────────────────────────────────────────────────────────────────────

create table seller_applications (
  id                         uuid not null default gen_random_uuid(),
  created_at                 timestamp with time zone not null default now(),
  updated_at                 timestamp with time zone not null default now(),
  business_name              text not null,
  contact_name               text not null,
  email                      text not null,
  website                    text,
  what_you_sell              text not null,
  price_range                text,
  ships_from                 text,
  user_id                    uuid,
  ip_hash                    text,
  status                     text not null default 'new'::text,
  admin_note                 text,
  constraint seller_applications_pkey PRIMARY KEY (id),
  constraint seller_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint seller_applications_admin_note_check CHECK ((char_length(admin_note) <= 1000)),
  constraint seller_applications_business_name_check CHECK (((char_length(business_name) >= 1) AND (char_length(business_name) <= 120))),
  constraint seller_applications_contact_name_check CHECK (((char_length(contact_name) >= 1) AND (char_length(contact_name) <= 120))),
  constraint seller_applications_email_check CHECK (((char_length(email) >= 3) AND (char_length(email) <= 200))),
  constraint seller_applications_ip_hash_check CHECK ((char_length(ip_hash) <= 64)),
  constraint seller_applications_price_range_check CHECK ((char_length(price_range) <= 40)),
  constraint seller_applications_ships_from_check CHECK ((char_length(ships_from) <= 120)),
  constraint seller_applications_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'approved'::text, 'declined'::text]))),
  constraint seller_applications_website_check CHECK ((char_length(website) <= 300)),
  constraint seller_applications_what_you_sell_check CHECK (((char_length(what_you_sell) >= 1) AND (char_length(what_you_sell) <= 1000)))
);

create index seller_applications_created on seller_applications (created_at DESC);
create index seller_applications_ip on seller_applications (ip_hash, created_at DESC);

alter table seller_applications enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- 17. ACCOUNT DELETION
-- ══════════════════════════════════════════════════════════════════════════

-- Service role only (020). Deletes what a user created and unlinks the
-- partner's rows that pointed at it; everything else cascades when the
-- auth user is deleted.
create or replace function public.purge_user_data(target uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  -- Partner items that point at this user's content: unlink, don't delete.
  update bucket_list     set linked_memory_id = null where linked_memory_id in (select id from memories where created_by = target);
  update important_dates set linked_memory_id = null where linked_memory_id in (select id from memories where created_by = target);
  update todos           set assigned_to = null      where assigned_to = target and created_by <> target;
  update watch_sessions  set last_updated_by = created_by where last_updated_by = target and created_by <> target;

  -- Everything this user created.
  delete from watch_messages   where user_id = target;
  delete from watch_sessions   where created_by = target;
  delete from photos           where uploaded_by = target;
  delete from journal_photos   where uploaded_by = target;
  delete from memories         where created_by = target;
  delete from journal_entries  where created_by = target;
  delete from books            where uploaded_by = target;
  delete from reading_progress where user_id = target;
  delete from music_moments    where added_by = target;
  delete from watchlist        where added_by = target;
  delete from bucket_list      where created_by = target;
  delete from important_dates  where created_by = target;
  delete from todos            where created_by = target;
  delete from prompt_responses where user_id = target;
  delete from prompts          where created_by = target and is_stock is not true;
  -- The rest (profile, couple, games, study, coupons, trivia, love taps, push
  -- subscriptions) cascade when the auth user is deleted.
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- 18. SECURITY
-- ══════════════════════════════════════════════════════════════════════════
-- Applied last so it covers every table above.

-- ──────────────────────────────────────────────────────────────────────────
-- 2FA: a restrictive policy on every RLS table (021). Once a user has a
-- verified factor, nothing is readable or writable until they pass it.
-- Left out: seller_applications, store_products, watch_messages, watch_sessions.
-- ──────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'assignments', 'board_games', 'books', 'bucket_list',
    'closeness_checkins', 'couple', 'couple_plus', 'coupon_catalog',
    'coupons', 'depth_optins', 'feedback', 'gift_sizes', 'home_layouts',
    'home_notes', 'important_dates', 'jar_settings', 'jar_slips',
    'journal_entries', 'journal_photos', 'lesson_progress', 'letters',
    'love_taps', 'lovemap_reviews', 'memories', 'messages', 'milestones',
    'music_moments', 'native_push_tokens', 'notify_prefs', 'photos',
    'plus_intro_seen', 'plus_trials', 'profiles', 'prompt_responses',
    'prompts', 'push_subscriptions', 'reading_progress', 'store_addresses',
    'store_orders', 'study_attempts', 'study_cards', 'study_decks',
    'study_progress', 'talk_sessions', 'todos', 'trail_progress',
    'trail_stamps', 'trivia_questions', 'watch_queue', 'watchlist'
  ] loop
    execute format(
      'create policy "Require 2FA when enabled" on %I as restrictive for all to authenticated
         using ((select mfa_ok())) with check ((select mfa_ok()))', t);
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- Table and column grants (018 onward). anon gets nothing. Where a client
-- may only touch some columns, the table privilege is revoked and granted
-- back per column. MAINTENANCE: a new column the app reads from profiles,
-- or writes on couple / coupons / messages, needs its column grant here.
-- ──────────────────────────────────────────────────────────────────────────

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

revoke update on couple from authenticated;
revoke insert, update, delete on coupon_catalog from authenticated;
revoke insert, update on coupons from authenticated;
revoke delete, truncate on feedback from authenticated;
revoke delete on home_layouts from authenticated;
revoke delete on home_notes from authenticated;
revoke insert, select, update, truncate, references, trigger on jar_slips from authenticated;
revoke update on lesson_progress from authenticated;
revoke insert, select, update, truncate, references, trigger on letters from authenticated;
revoke insert, update on messages from authenticated;
revoke insert, update, delete on milestones from authenticated;
revoke insert, update, delete on plus_trials from authenticated;
revoke select on profiles from authenticated;
revoke insert, update, delete on talk_sessions from authenticated;
revoke update on trail_progress from authenticated;
revoke insert, update, delete on trail_stamps from authenticated;

grant update (
  jellyfin_api_key, jellyfin_url, real_debrid_api_key, show_timer,
  theater_passcode_hash, theme, together_since, torbox_api_key
) on couple to authenticated;
grant update (
  done_at, redeemed, redeemed_at, revealed_at
) on coupons to authenticated;
grant insert (author, body, couple_id, jar) on jar_slips to authenticated;
grant select (
  author, couple_id, created_at, drawn_at, id, jar
) on jar_slips to authenticated;
grant update (note) on lesson_progress to authenticated;
grant insert (
  author, body, couple_id, open_when, recipient, title, unlock_at
) on letters to authenticated;
grant select (
  author, couple_id, created_at, id, open_when, opened_at, recipient,
  title, unlock_at
) on letters to authenticated;
grant insert (body, couple_id, kind, sender) on messages to authenticated;
grant update (reaction, read_at) on messages to authenticated;
grant select (
  accent_color, activity, activity_at, avatar_url, banner_url, bio,
  created_at, display_name, id, spotify_display_name, status_text,
  time_zone, username, xp_goal
) on profiles to authenticated;
grant insert (
  couple_id, minutes, started_by
) on talk_sessions to authenticated;
grant update (completed, ended_at, minutes) on talk_sessions to authenticated;
grant update (note) on trail_progress to authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- Function grants. Every function is callable by signed-in users only,
-- except invite_preview (also anon), limit_urgent and milestone_defs
-- (default grant to public) and purge_user_data (service role only).
-- ──────────────────────────────────────────────────────────────────────────

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function limit_urgent() to public;
grant execute on function milestone_defs() to public;
grant execute on function invite_preview(text) to anon;
revoke execute on function purge_user_data(uuid) from authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 19. REALTIME
-- ══════════════════════════════════════════════════════════════════════════
-- Tables whose changes are pushed to subscribed clients.

alter publication supabase_realtime add table board_games;
alter publication supabase_realtime add table coupons;
alter publication supabase_realtime add table home_notes;
alter publication supabase_realtime add table jar_slips;
alter publication supabase_realtime add table lesson_progress;
alter publication supabase_realtime add table letters;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table prompt_responses;
alter publication supabase_realtime add table talk_sessions;
alter publication supabase_realtime add table watch_messages;


-- ══════════════════════════════════════════════════════════════════════════
-- 20. STORAGE
-- ══════════════════════════════════════════════════════════════════════════
-- Private buckets (photos, videos, epubs) keep each user's files under a
-- folder named after their user id; couple members can read each other's
-- (003). avatars and banners are public and hold one file per user, named
-- after the user id (004). Size limits from 018.

insert into storage.buckets (id, name, public, file_size_limit) values
  ('avatars', 'avatars', true,  10485760),   -- 10 MB
  ('banners', 'banners', true,  10485760),   -- 10 MB
  ('photos',  'photos',  false, 52428800),   -- 50 MB
  ('epubs',   'epubs',   false, 209715200),  -- 200 MB
  ('videos',  'videos',  false, null)
on conflict (id) do nothing;

create policy "Anyone can read avatars"
  on storage.objects for select
  using ((bucket_id = 'avatars'::text));
create policy "Anyone can read banners"
  on storage.objects for select
  using ((bucket_id = 'banners'::text));
create policy "Couple can delete epubs"
  on storage.objects for delete to authenticated
  using (((bucket_id = 'epubs'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Couple can delete photos"
  on storage.objects for delete to authenticated
  using (((bucket_id = 'photos'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Couple can delete videos"
  on storage.objects for delete to authenticated
  using (((bucket_id = 'videos'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Couple can read epubs"
  on storage.objects for select to authenticated
  using (((bucket_id = 'epubs'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Couple can read photos"
  on storage.objects for select to authenticated
  using (((bucket_id = 'photos'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Couple can read videos"
  on storage.objects for select to authenticated
  using (((bucket_id = 'videos'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Couple can update epubs"
  on storage.objects for update to authenticated
  using (((bucket_id = 'epubs'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Couple can update photos"
  on storage.objects for update to authenticated
  using (((bucket_id = 'photos'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Couple can update videos"
  on storage.objects for update to authenticated
  using (((bucket_id = 'videos'::text) AND (EXISTS ( SELECT 1
   FROM couple c
  WHERE (((c.user1_id = auth.uid()) OR (c.user2_id = auth.uid())) AND ((c.user1_id = ((storage.foldername(objects.name))[1])::uuid) OR (c.user2_id = ((storage.foldername(objects.name))[1])::uuid)))))));
create policy "Owner can delete avatar"
  on storage.objects for delete to authenticated
  using (((bucket_id = 'avatars'::text) AND (name = (auth.uid())::text)));
create policy "Owner can delete banner"
  on storage.objects for delete to authenticated
  using (((bucket_id = 'banners'::text) AND (name = (auth.uid())::text)));
create policy "Owner can update avatar"
  on storage.objects for update to authenticated
  using (((bucket_id = 'avatars'::text) AND (name = (auth.uid())::text)));
create policy "Owner can update banner"
  on storage.objects for update to authenticated
  using (((bucket_id = 'banners'::text) AND (name = (auth.uid())::text)));
create policy "Owner can upload avatar"
  on storage.objects for insert to authenticated
  with check (((bucket_id = 'avatars'::text) AND (name = (auth.uid())::text)));
create policy "Owner can upload banner"
  on storage.objects for insert to authenticated
  with check (((bucket_id = 'banners'::text) AND (name = (auth.uid())::text)));
create policy "Owner can upload epubs"
  on storage.objects for insert to authenticated
  with check (((bucket_id = 'epubs'::text) AND (((storage.foldername(name))[1])::uuid = auth.uid())));
create policy "Owner can upload photos"
  on storage.objects for insert to authenticated
  with check (((bucket_id = 'photos'::text) AND (((storage.foldername(name))[1])::uuid = auth.uid())));
create policy "Owner can upload videos"
  on storage.objects for insert to authenticated
  with check (((bucket_id = 'videos'::text) AND (((storage.foldername(name))[1])::uuid = auth.uid())));


-- ══════════════════════════════════════════════════════════════════════════
-- 21. MIGRATION LOG
-- ══════════════════════════════════════════════════════════════════════════
-- What each file in migrations/ changed. Every one is safe to re-run.
-- (012 and 013 were never committed.)
--
-- 001 Removed a policy that leaked party watch_sessions across couples.
-- 002 accept_invite(): claiming a couple's open slot needs the invite token.
-- 003 Storage: private buckets isolated per couple.
-- 004 profiles.accent_color / banner_url and the public `banners` bucket.
-- 005 Study: study_decks, study_cards, study_attempts, study_progress.
-- 006 assignments; study_attempts.mode gains 'write', 'learn', 'assignment'.
-- 007 study_attempts.coins and profiles.xp_goal.
-- 008 coupons (bought with coins).
-- 009 assignments.xp_awarded, so turn-in XP is granted once.
-- 010 profiles.activity / activity_at: status shown on presence cards.
-- 011 couple.theater_passcode_hash.
-- 014 accept_invite() replaces the invitee's own empty space.
-- 015 board_games, trivia_questions; 'most_likely' prompts.
-- 016 push_subscriptions + partner_push_subscriptions() and pruning.
-- 017 love_taps.
-- 018 Security hardening: per-column grants on profiles and couple, every
--     UPDATE policy's WITH CHECK = USING, anon loses all table access,
--     bucket size limits.
-- 019 prompt_responses joins the realtime publication.
-- 020 purge_user_data(): service-role account deletion.
-- 021 mfa_ok() and the restrictive 2FA policy.
-- 022 push_subscriptions.private.
-- 023 talk_sessions.
-- 024 messages.
-- 025 letters, jar_slips, jar_settings and their functions.
-- 026 Grow: coupons rework, coupon_catalog, milestones, lesson_progress,
--     lovemap_reviews and the milestone functions.
-- 027 prompts.depth, depth_optins, couple_depth(); notify_prefs; urgent
--     messages and limit_urgent.
-- 028 native_push_tokens and its functions.
-- 029 couple_plus, couple_has_plus().
-- 030 Store: store_addresses, store_orders, partner_has_gift_address(),
--     incoming_gifts().
-- 031 confirm_gift_arrived().
-- 032 store_orders.vendor / vendor_order_id / vendor_error.
-- 033 seller_applications.
-- 034 store_products.
-- 035 store_products.category gains 'her' / 'him'.
-- 036 store_products.options, store_orders.option.
-- 037 gift_sizes, partner_size_kinds().
-- 038 trail_progress, trail_stamps, finish_trail(); After Dark (prompts.depth 4,
--     depth_optins.after_dark, couple_after_dark()); closeness_checkins.
-- 039 plus_trials, start_plus_trial(), plus_intro_seen; trials count as Plus.
-- 040 home_layouts, home_notes, profiles.time_zone.
-- 041 store_orders.photos.
-- 042 feedback.
-- 043 watch_queue.
-- 044 invite_preview().
-- 045 couple.paired_at, stamped by accept_invite().

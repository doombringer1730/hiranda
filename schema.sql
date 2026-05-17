-- Hiranda Database Schema
-- Run this in the Supabase SQL editor to set up the database.

-- ─────────────────────────────────────────
-- USERS (managed by Supabase Auth)
-- We extend the auth.users table with a profiles table.
-- ─────────────────────────────────────────

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view all profiles"
  on profiles for select using (true);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);


-- ─────────────────────────────────────────
-- MEMORIES / JOURNAL ENTRIES
-- ─────────────────────────────────────────

create table memories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  happened_at date not null default current_date,
  created_by uuid references auth.users not null,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table memories enable row level security;

create policy "Authenticated users can read all memories"
  on memories for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert memories"
  on memories for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update memories"
  on memories for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete memories"
  on memories for delete using (auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- PHOTOS (attached to memories)
-- Files stored in Supabase Storage bucket: photos
-- ─────────────────────────────────────────

create table photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references memories on delete cascade not null,
  storage_path text not null,
  caption text,
  uploaded_by uuid references auth.users not null,
  created_at timestamptz default now()
);

alter table photos enable row level security;

create policy "Authenticated users can read all photos"
  on photos for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert photos"
  on photos for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete photos"
  on photos for delete using (auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- TODOS / CHORE LIST
-- ─────────────────────────────────────────

create table todos (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  completed boolean default false,
  assigned_to uuid references auth.users,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

alter table todos enable row level security;

create policy "Authenticated users can read all todos"
  on todos for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert todos"
  on todos for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update todos"
  on todos for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete todos"
  on todos for delete using (auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- BUCKET LIST / GOALS
-- ─────────────────────────────────────────

create table bucket_list (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text check (category in ('travel', 'food', 'experience', 'other')) default 'other',
  completed boolean default false,
  completed_at timestamptz,
  linked_memory_id uuid references memories,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

alter table bucket_list enable row level security;

create policy "Authenticated users can read all bucket list items"
  on bucket_list for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert bucket list items"
  on bucket_list for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update bucket list items"
  on bucket_list for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete bucket list items"
  on bucket_list for delete using (auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- IMPORTANT DATES / ANNIVERSARIES
-- ─────────────────────────────────────────

create table important_dates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  date date not null,
  recurring boolean default true,
  note text,
  linked_memory_id uuid references memories,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

alter table important_dates enable row level security;

create policy "Authenticated users can read all dates"
  on important_dates for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert dates"
  on important_dates for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update dates"
  on important_dates for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete dates"
  on important_dates for delete using (auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- WATCH TOGETHER (synchronized movie viewing)
-- ─────────────────────────────────────────

create table watch_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null,
  state text check (state in ('paused', 'playing')) default 'paused',
  playback_position_seconds float default 0,
  last_updated_by uuid references auth.users,
  updated_at timestamptz default now(),
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

alter table watch_sessions enable row level security;

create policy "Authenticated users can read watch sessions"
  on watch_sessions for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert watch sessions"
  on watch_sessions for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update watch sessions"
  on watch_sessions for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete watch sessions"
  on watch_sessions for delete using (auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- STORAGE BUCKETS (run separately in Supabase dashboard or via CLI)
-- ─────────────────────────────────────────

-- insert into storage.buckets (id, name, public) values ('photos', 'photos', false);
-- insert into storage.buckets (id, name, public) values ('videos', 'videos', false);


-- ─────────────────────────────────────────
-- WATCHLIST
-- ─────────────────────────────────────────

create table watchlist (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text check (type in ('movie', 'show')) default 'movie',
  note text,
  watched boolean default false,
  watched_at timestamptz,
  added_by uuid references auth.users not null,
  created_at timestamptz default now()
);

alter table watchlist enable row level security;

create policy "Authenticated users can read watchlist"
  on watchlist for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert watchlist"
  on watchlist for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update watchlist"
  on watchlist for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete watchlist"
  on watchlist for delete using (auth.role() = 'authenticated');

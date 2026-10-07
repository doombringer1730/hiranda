-- 026: Grow — the passport, coupons you earn together, the Path, and
-- Love Map review.
--
-- Milestones are awarded by award_milestones(), a security-definer function
-- that counts what the two of you have actually done (it can't be faked from
-- the app). Each new milestone stamps the shared passport and gives BOTH of
-- you a coupon to use on each other, drawn from coupon_catalog by rarity.
--
-- Coupons: created only by functions (milestones, or give_coupon() for a
-- free gift to your partner). The holder (bought_by) can reveal, use and
-- delete theirs; the partner marks a used coupon done. Column grants keep
-- titles and owners read-only.
--
-- lesson_progress: each of you marks Path lessons done (with an optional
-- note). lovemap_reviews: your own spaced-repetition boxes for questions
-- your partner has answered.
--
-- Safe to re-run.

-- ── Coupons: new columns ──
alter table coupons add column if not exists rarity text not null default 'common';
alter table coupons add column if not exists source text not null default 'gift';
alter table coupons add column if not exists given_by uuid references auth.users on delete set null;
alter table coupons add column if not exists revealed_at timestamptz;
alter table coupons add column if not exists done_at timestamptz;
alter table coupons drop constraint if exists coupons_rarity_check;
alter table coupons add constraint coupons_rarity_check check (rarity in ('gift', 'common', 'rare', 'legendary'));

revoke insert, update on coupons from authenticated;
grant update (redeemed, redeemed_at, revealed_at, done_at) on coupons to authenticated;
drop policy if exists "Users buy their own coupons" on coupons;

-- ── Coupon catalog ──
create table if not exists coupon_catalog (
  id      serial primary key,
  rarity  text not null check (rarity in ('common', 'rare', 'legendary')),
  emoji   text not null,
  title   text not null unique
);
alter table coupon_catalog enable row level security;
drop policy if exists "Anyone signed in can read the catalog" on coupon_catalog;
create policy "Anyone signed in can read the catalog" on coupon_catalog for select to authenticated using (true);
revoke insert, update, delete on coupon_catalog from authenticated, anon;

insert into coupon_catalog (rarity, emoji, title) values
  ('common', '🎬', 'I pick the movie — no veto'),
  ('common', '☕', 'Coffee in bed (or I order you one)'),
  ('common', '🎧', 'Control the aux all day'),
  ('common', '🍝', 'You choose dinner — no “I don’t know”'),
  ('common', '🧺', 'Skip one chore, I’ve got it'),
  ('common', '📞', 'FaceTime until we fall asleep'),
  ('common', '🎙️', 'A voice note or song, on demand'),
  ('common', '💆', '10-minute back scratch'),
  ('common', '⏸️', 'Pause button: 20 minutes off mid-argument, then we come back'),
  ('common', '👂', '10 minutes where I only listen'),
  ('common', '🍿', 'Watch party — your pick, I’m there'),
  ('common', '🌅', 'Good-morning call, any day you want'),
  ('rare', '🎁', 'A surprise delivery to your door'),
  ('rare', '🤫', 'A surprise date — you know nothing'),
  ('rare', '💌', 'A handwritten letter, on demand'),
  ('rare', '📵', 'A phone-free evening, all of me'),
  ('rare', '🔁', 'Do-over: we restart a conversation that went sideways'),
  ('rare', '🍳', 'Breakfast, made from scratch'),
  ('rare', '🕰️', 'Recreate our first date'),
  ('rare', '📦', 'A care package, packed with inside jokes'),
  ('legendary', '👑', 'A whole day of your choosing'),
  ('legendary', '✨', 'Describe your dream date — I make it happen'),
  ('legendary', '🧳', 'A weekend away, planned entirely by me'),
  ('legendary', '🛁', 'A full spa night, start to finish')
on conflict (title) do nothing;

-- ── Milestones (the passport) ──
create table if not exists milestones (
  couple_id  uuid not null references couple(id) on delete cascade,
  key        text not null,
  earned_at  timestamptz not null default now(),
  primary key (couple_id, key)
);
alter table milestones enable row level security;
drop policy if exists "Couple members see their passport" on milestones;
create policy "Couple members see their passport" on milestones for select using (
  exists (select 1 from couple c where c.id = milestones.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
revoke insert, update, delete on milestones from authenticated, anon;

-- ── Path lessons ──
create table if not exists lesson_progress (
  couple_id     uuid not null references couple(id) on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  lesson_key    text not null check (char_length(lesson_key) <= 40),
  note          text check (char_length(note) <= 1000),
  completed_at  timestamptz not null default now(),
  primary key (user_id, lesson_key)
);
create index if not exists lesson_progress_couple_idx on lesson_progress (couple_id);
alter table lesson_progress enable row level security;
drop policy if exists "Couple members see lesson progress" on lesson_progress;
create policy "Couple members see lesson progress" on lesson_progress for select using (
  exists (select 1 from couple c where c.id = lesson_progress.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
drop policy if exists "Complete your own lessons" on lesson_progress;
create policy "Complete your own lessons" on lesson_progress for insert with check (
  user_id = auth.uid()
  and exists (select 1 from couple c where c.id = lesson_progress.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
drop policy if exists "Edit your own lesson notes" on lesson_progress;
create policy "Edit your own lesson notes" on lesson_progress for update using (user_id = auth.uid());
revoke update on lesson_progress from authenticated;
grant update (note) on lesson_progress to authenticated;

-- ── Love Map review (spaced repetition, Leitner boxes) ──
create table if not exists lovemap_reviews (
  user_id    uuid not null references auth.users on delete cascade,
  prompt_id  uuid not null references prompts(id) on delete cascade,
  box        int not null default 0 check (box between 0 and 6),
  due_on     date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);
alter table lovemap_reviews enable row level security;
drop policy if exists "Your own review boxes" on lovemap_reviews;
create policy "Your own review boxes" on lovemap_reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2FA, like every other table (see 021).
do $$
declare t text;
begin
  foreach t in array array['coupon_catalog', 'milestones', 'lesson_progress', 'lovemap_reviews'] loop
    execute format('drop policy if exists "Require 2FA when enabled" on public.%I', t);
    execute format('create policy "Require 2FA when enabled" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- ── Milestone definitions ──
-- track: what's counted. Thresholds rise; rarer coupons come later.
create or replace function public.milestone_defs()
returns table (key text, track text, threshold int, rarity text)
language sql immutable as $$
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

-- Where each track stands for your couple right now.
create or replace function public.milestone_progress()
returns table (track text, value int)
language plpgsql
stable
security definer
set search_path = public
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
revoke all on function public.milestone_progress() from public, anon;
grant execute on function public.milestone_progress() to authenticated;

-- Stamp any milestones you've newly reached, and give you both a coupon for
-- each. Returns the keys just earned (usually none).
create or replace function public.award_milestones()
returns table (key text)
language plpgsql
security definer
set search_path = public
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
revoke all on function public.award_milestones() from public, anon;
grant execute on function public.award_milestones() to authenticated;

-- A free coupon for your partner — from the catalog or your own words.
create or replace function public.give_coupon(p_title text, p_emoji text)
returns uuid
language plpgsql
security definer
set search_path = public
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
revoke all on function public.give_coupon(text, text) from public, anon;
grant execute on function public.give_coupon(text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'coupons') then
      alter publication supabase_realtime add table coupons;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lesson_progress') then
      alter publication supabase_realtime add table lesson_progress;
    end if;
  end if;
end $$;

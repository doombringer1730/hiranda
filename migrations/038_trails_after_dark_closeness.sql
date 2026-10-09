-- 038: Trails, the After Dark deck, and the closeness check-in.
--
-- TRAILS — short guided courses (5 days) on one topic you pick together.
-- trail_progress works like lesson_progress: each of you marks a day done,
-- with an optional note your partner sees once you've both finished it.
-- finish_trail() stamps a finished trail once and gives you both a coupon;
-- it checks the days really are done by both of you.
--
-- AFTER DARK — an intimacy question deck (prompts.depth = 4). It sits beside
-- the Light → Deepest ladder, not on it: depth_optins.after_dark is its own
-- opt-in, and couple_after_dark() is true only when BOTH of you said yes.
-- The daily question never draws from it (it only uses depths up to
-- couple_depth(), which stays 1–3).
--
-- CLOSENESS — a private check-in about every four weeks: how close you've felt
-- lately, 1–5. Only you can ever read your own check-ins.
--
-- Safe to re-run.

-- ── Trails ──
create table if not exists trail_progress (
  couple_id     uuid not null references couple(id) on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  trail_key     text not null check (char_length(trail_key) <= 24),
  day           smallint not null check (day between 1 and 7),
  note          text check (char_length(note) <= 1000),
  completed_at  timestamptz not null default now(),
  primary key (user_id, trail_key, day)
);
create index if not exists trail_progress_couple_idx on trail_progress (couple_id, trail_key);
alter table trail_progress enable row level security;
drop policy if exists "Couple members see trail progress" on trail_progress;
create policy "Couple members see trail progress" on trail_progress for select using (
  exists (select 1 from couple c where c.id = trail_progress.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
drop policy if exists "Finish your own trail days" on trail_progress;
create policy "Finish your own trail days" on trail_progress for insert with check (
  user_id = auth.uid()
  and exists (select 1 from couple c where c.id = trail_progress.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
drop policy if exists "Edit your own trail notes" on trail_progress;
create policy "Edit your own trail notes" on trail_progress for update using (user_id = auth.uid());
revoke update on trail_progress from authenticated;
grant update (note) on trail_progress to authenticated;

create table if not exists trail_stamps (
  couple_id  uuid not null references couple(id) on delete cascade,
  trail_key  text not null check (char_length(trail_key) <= 24),
  earned_at  timestamptz not null default now(),
  primary key (couple_id, trail_key)
);
alter table trail_stamps enable row level security;
drop policy if exists "Couple members see trail stamps" on trail_stamps;
create policy "Couple members see trail stamps" on trail_stamps for select using (
  exists (select 1 from couple c where c.id = trail_stamps.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
revoke insert, update, delete on trail_stamps from authenticated, anon;

-- Stamp a finished trail (every day done by both of you) and give you both a
-- rare coupon. Once per trail. Returns true when it stamped just now.
create or replace function public.finish_trail(p_trail text)
returns boolean
language plpgsql
security definer
set search_path = public
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
revoke all on function public.finish_trail(text) from public, anon;
grant execute on function public.finish_trail(text) to authenticated;

-- ── After Dark ──
alter table prompts drop constraint if exists prompts_depth_check;
alter table prompts add constraint prompts_depth_check check (depth between 1 and 4);

alter table depth_optins add column if not exists after_dark boolean not null default false;

create or replace function public.couple_after_dark()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(bool_and(coalesce(o.after_dark, false)), false)
    from couple c
    cross join lateral (values (c.user1_id), (c.user2_id)) as m(uid)
    left join depth_optins o on o.user_id = m.uid
   where c.id = (select id from couple
                  where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
                  order by user2_id nulls last limit 1)
$$;
revoke all on function public.couple_after_dark() from public, anon;
grant execute on function public.couple_after_dark() to authenticated;

insert into prompts (type, text, is_stock, depth)
select 'question', t.text, true, 4
  from (values
    ('What''s a moment you felt really wanted by me?'),
    ('What makes you feel desired, not just loved?'),
    ('When do you feel most attractive?'),
    ('What kind of touch do you love when you''re not in the mood for more?'),
    ('What''s your favourite way for me to start things?'),
    ('What helps you switch off from the day and feel close to me?'),
    ('How do you like to say no, and how do you like to hear it?'),
    ('What''s a memory of us you think about more than you''d admit?'),
    ('Morning or night, and why?'),
    ('What''s one thing I do that you''d love more of?'),
    ('What''s something you''re a little shy to ask for?'),
    ('What does feeling safe with me look like for you?'),
    ('What''s a compliment about your body you''d love to hear?'),
    ('What would a slow evening with just the two of us look like?'),
    ('What''s your favourite kind of kiss?'),
    ('What''s a text from me that would make your whole day?'),
    ('Is there a song that puts you in the mood?'),
    ('What''s something small and new you''d like us to try?'),
    ('Is there something that turns you off that I might not know about?'),
    ('Honestly, how often would you like us to make time for each other like this?'),
    ('What do you remember about our first kiss?'),
    ('What''s a daydream about us you''d be okay sharing, just a little?'),
    ('What do you wish we talked about more when we''re close?'),
    ('After a long week, what do you want most: closeness, quiet or play?'),
    ('How has what you want changed since we met?'),
    ('What''s something I wear that you love?'),
    ('If tonight could go any way you wanted, how would it start?'),
    ('Where''s the most unexpected place you''ve wanted to kiss me?'),
    ('What makes you feel playful with me?'),
    ('What''s something I did once that you''d love me to do again?')
  ) as t(text)
 where not exists (select 1 from prompts p where p.type = 'question' and p.text = t.text);

-- ── Closeness check-in ──
create table if not exists closeness_checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  couple_id   uuid not null references couple(id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  created_at  timestamptz not null default now()
);
create index if not exists closeness_checkins_user_idx on closeness_checkins (user_id, created_at desc);
alter table closeness_checkins enable row level security;
drop policy if exists "Only you see your check-ins" on closeness_checkins;
create policy "Only you see your check-ins" on closeness_checkins for select using (user_id = auth.uid());
drop policy if exists "Check in for yourself" on closeness_checkins;
create policy "Check in for yourself" on closeness_checkins for insert with check (
  user_id = auth.uid()
  and exists (select 1 from couple c where c.id = closeness_checkins.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
drop policy if exists "Remove your own check-ins" on closeness_checkins;
create policy "Remove your own check-ins" on closeness_checkins for delete using (user_id = auth.uid());

-- 2FA, like every other table (see 021).
do $$
declare t text;
begin
  foreach t in array array['trail_progress', 'trail_stamps', 'closeness_checkins'] loop
    execute format('drop policy if exists "Require 2FA when enabled" on public.%I', t);
    execute format('create policy "Require 2FA when enabled" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

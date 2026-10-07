-- 027: Question depth decks, and Do Not Disturb.
--
-- DEPTH — questions come in three decks: 1 Light, 2 Deeper, 3 Deepest
-- (escalating, reciprocal self-disclosure — Aron et al., 1997). A deck opens
-- only when BOTH partners have opted in to it: couple_depth() is the lower of
-- your two choices. Would-you-rather and the rest stay Light.
--
-- QUIET — notify_prefs holds your Do Not Disturb (dnd_until) and nightly
-- quiet hours (minutes after midnight, in your own time zone). Your partner
-- can read it (so the app can say "on Do Not Disturb") and the server skips
-- notifications to you while you're quiet — except urgent messages, which
-- are limited to 3 a day per sender.
--
-- Safe to re-run.

-- ── Depth ──
alter table prompts add column if not exists depth smallint not null default 1;
alter table prompts drop constraint if exists prompts_depth_check;
alter table prompts add constraint prompts_depth_check check (depth between 1 and 3);

update prompts set depth = 2 where is_stock and type = 'question' and text in (
  'What''s something you''ve always wanted to tell me but haven''t?',
  'What''s a dream you have that you haven''t shared with me yet?',
  'What''s one way I could be an even better partner?',
  'Where do you see us in five years?'
);

insert into prompts (type, text, is_stock, depth)
select 'question', t.text, true, t.depth
  from (values
    -- Light
    ('What''s the best thing that happened to you this week?', 1),
    ('If we had a free Saturday with zero plans, what would your perfect version look like?', 1),
    ('What''s a food you could happily eat every day for a month?', 1),
    ('What''s a show or movie you could rewatch forever?', 1),
    ('What''s the most “you” thing you did today?', 1),
    ('What''s a small luxury that makes your day better?', 1),
    ('Who would play us in a movie about our life?', 1),
    ('What''s a skill you''d love to learn just for fun?', 1),
    ('What''s your go-to comfort song right now?', 1),
    ('What''s a place you''ve been that you''d go back to tomorrow?', 1),
    -- Deeper
    ('What''s something you''re proud of that you rarely get to talk about?', 2),
    ('When do you feel most like yourself with me?', 2),
    ('What''s a worry that''s been sitting in the back of your mind lately?', 2),
    ('What did your family teach you about love — the good and the not-so-good?', 2),
    ('When was a moment you felt really understood by me?', 2),
    ('What''s something you''d like us to do more of?', 2),
    ('What does a perfect ordinary day together look like to you?', 2),
    ('What''s a habit of mine you secretly love?', 2),
    ('What''s one thing you''d want me to know on a hard day?', 2),
    ('What''s something you''re still learning about yourself?', 2),
    -- Deepest
    ('What''s a fear about us you''ve never said out loud?', 3),
    ('When have you felt most loved in your life, and why?', 3),
    ('What''s something from your past you wish I understood better?', 3),
    ('What does it feel like when we''re disconnected — and what helps you come back?', 3),
    ('If you could change one thing about how we handle conflict, what would it be?', 3),
    ('What do you need from me that you find hard to ask for?', 3),
    ('What''s a dream for your life you''d be scared to fail at?', 3),
    ('What do you think we''re each still healing from?', 3),
    ('What do you hope we''re like as a couple in twenty years?', 3),
    ('What''s something you''ve forgiven me for that I might not know about?', 3)
  ) as t(text, depth)
 where not exists (select 1 from prompts p where p.type = 'question' and p.text = t.text);

create table if not exists depth_optins (
  couple_id   uuid not null references couple(id) on delete cascade,
  user_id     uuid primary key references auth.users on delete cascade,
  max_depth   smallint not null default 1 check (max_depth between 1 and 3),
  updated_at  timestamptz not null default now()
);
alter table depth_optins enable row level security;
drop policy if exists "Couple members see depth choices" on depth_optins;
create policy "Couple members see depth choices" on depth_optins for select using (
  exists (select 1 from couple c where c.id = depth_optins.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
drop policy if exists "Choose your own depth" on depth_optins;
create policy "Choose your own depth" on depth_optins for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from couple c where c.id = depth_optins.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

-- The deepest deck you've BOTH opted in to (1 if either hasn't chosen).
create or replace function public.couple_depth()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(min(coalesce(o.max_depth, 1)), 1)::int
    from couple c
    cross join lateral (values (c.user1_id), (c.user2_id)) as m(uid)
    left join depth_optins o on o.user_id = m.uid
   where c.id = (select id from couple
                  where (user1_id = auth.uid() or user2_id = auth.uid()) and user2_id is not null
                  order by user2_id nulls last limit 1)
$$;
revoke all on function public.couple_depth() from public, anon;
grant execute on function public.couple_depth() to authenticated;

-- ── Quiet ──
create table if not exists notify_prefs (
  user_id      uuid primary key references auth.users on delete cascade,
  dnd_until    timestamptz,
  quiet_start  smallint check (quiet_start between 0 and 1439),
  quiet_end    smallint check (quiet_end between 0 and 1439),
  tz           text check (char_length(tz) <= 64),
  updated_at   timestamptz not null default now()
);
alter table notify_prefs enable row level security;
drop policy if exists "Your own quiet settings" on notify_prefs;
create policy "Your own quiet settings" on notify_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Your partner can see when you're quiet" on notify_prefs;
create policy "Your partner can see when you're quiet" on notify_prefs for select using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() and c.user2_id = notify_prefs.user_id)
                                    or (c.user2_id = auth.uid() and c.user1_id = notify_prefs.user_id)));

-- 2FA, like every other table (see 021).
do $$
declare t text;
begin
  foreach t in array array['depth_optins', 'notify_prefs'] loop
    execute format('drop policy if exists "Require 2FA when enabled" on public.%I', t);
    execute format('create policy "Require 2FA when enabled" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- ── Urgent messages (bypass Do Not Disturb, 3 a day) ──
alter table messages drop constraint if exists messages_kind_check;
alter table messages add constraint messages_kind_check check (kind in ('text', 'good_news', 'urgent'));

create or replace function public.limit_urgent()
returns trigger
language plpgsql
security definer
set search_path = public
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
drop trigger if exists messages_limit_urgent on messages;
create trigger messages_limit_urgent before insert on messages for each row execute function public.limit_urgent();

-- 025: Letters and jars.
--
-- LETTERS — "open when…" letters (open when you miss me / can't sleep / had
-- a bad day) and letters sealed until a date. The body is sealed in the
-- database: the `body` column isn't selectable, and read_letter() returns it
-- only to the author, or to the recipient once it's unlocked (and marks it
-- opened).
--
-- JARS — two kinds of folded slips:
--   'ours'   each of you writes things to do together; a draw pulls one
--            slip from each of you at once. Your partner's slips stay hidden
--            until they're drawn.
--   'thanks' the appreciation jar: little thank-you notes for your partner,
--            sealed until the jar's opening day (jar_settings.thanks_open_on).
-- As with letters, slip bodies are only readable through jar_slips_for().
--
-- Safe to re-run.

-- ── Letters ──
create table if not exists letters (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references couple(id) on delete cascade,
  author      uuid not null references auth.users on delete cascade,
  recipient   uuid not null references auth.users on delete cascade,
  open_when   text check (char_length(open_when) <= 80),
  title       text check (char_length(title) <= 120),
  body        text not null check (char_length(body) between 1 and 20000),
  unlock_at   timestamptz,
  opened_at   timestamptz,
  created_at  timestamptz not null default now(),
  check (author <> recipient)
);
create index if not exists letters_couple_idx on letters (couple_id, created_at desc);
alter table letters enable row level security;

drop policy if exists "Couple members see letter envelopes" on letters;
create policy "Couple members see letter envelopes" on letters for select using (
  (author = auth.uid() or recipient = auth.uid())
  and exists (select 1 from couple c where c.id = letters.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Write letters to your partner" on letters;
create policy "Write letters to your partner" on letters for insert with check (
  author = auth.uid()
  and exists (select 1 from couple c where c.id = letters.couple_id
    and ((c.user1_id = auth.uid() and c.user2_id = letters.recipient)
      or (c.user2_id = auth.uid() and c.user1_id = letters.recipient))));

drop policy if exists "Authors take back their letters" on letters;
create policy "Authors take back their letters" on letters for delete using (author = auth.uid());

drop policy if exists "Require 2FA when enabled" on letters;
create policy "Require 2FA when enabled" on letters as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

revoke all on letters from anon, authenticated;
grant select (id, couple_id, author, recipient, open_when, title, unlock_at, opened_at, created_at) on letters to authenticated;
grant insert (couple_id, author, recipient, open_when, title, body, unlock_at) on letters to authenticated;
grant delete on letters to authenticated;

create or replace function public.read_letter(p_id uuid)
returns table (body text, opened_at timestamptz)
language plpgsql
security definer
set search_path = public
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
revoke all on function public.read_letter(uuid) from public, anon;
grant execute on function public.read_letter(uuid) to authenticated;

-- ── Jars ──
create table if not exists jar_slips (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references couple(id) on delete cascade,
  jar         text not null check (jar in ('ours', 'thanks')),
  author      uuid not null references auth.users on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  drawn_at    timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists jar_slips_couple_idx on jar_slips (couple_id, jar, created_at desc);
alter table jar_slips enable row level security;

drop policy if exists "Couple members see jar slips" on jar_slips;
create policy "Couple members see jar slips" on jar_slips for select using (
  exists (select 1 from couple c where c.id = jar_slips.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Add your own slips" on jar_slips;
create policy "Add your own slips" on jar_slips for insert with check (
  author = auth.uid()
  and exists (select 1 from couple c where c.id = jar_slips.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Take back your own undrawn slips" on jar_slips;
create policy "Take back your own undrawn slips" on jar_slips for delete using (author = auth.uid() and drawn_at is null);

drop policy if exists "Require 2FA when enabled" on jar_slips;
create policy "Require 2FA when enabled" on jar_slips as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

revoke all on jar_slips from anon, authenticated;
grant select (id, couple_id, jar, author, drawn_at, created_at) on jar_slips to authenticated;
grant insert (couple_id, jar, author, body) on jar_slips to authenticated;
grant delete on jar_slips to authenticated;

create table if not exists jar_settings (
  couple_id       uuid primary key references couple(id) on delete cascade,
  thanks_open_on  date
);
alter table jar_settings enable row level security;
drop policy if exists "Couple members manage jar settings" on jar_settings;
create policy "Couple members manage jar settings" on jar_settings for all using (
  exists (select 1 from couple c where c.id = jar_settings.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())))
  with check (
  exists (select 1 from couple c where c.id = jar_settings.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
drop policy if exists "Require 2FA when enabled" on jar_settings;
create policy "Require 2FA when enabled" on jar_settings as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
revoke all on jar_settings from anon;

-- Slips you're allowed to read: your own; drawn 'ours' slips; and 'thanks'
-- notes written to you before an opening day that has arrived.
create or replace function public.jar_slips_for(p_jar text)
returns table (id uuid, author uuid, body text, drawn_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = public
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
revoke all on function public.jar_slips_for(text) from public, anon;
grant execute on function public.jar_slips_for(text) to authenticated;

-- Pull one undrawn slip from each of you, at random, at the same moment.
create or replace function public.draw_from_jar()
returns table (id uuid, author uuid, body text)
language plpgsql
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
  select s.id into a from jar_slips s where s.couple_id = c.id and s.jar = 'ours' and s.drawn_at is null and s.author = c.user1_id order by random() limit 1 for update skip locked;
  select s.id into b from jar_slips s where s.couple_id = c.id and s.jar = 'ours' and s.drawn_at is null and s.author = c.user2_id order by random() limit 1 for update skip locked;
  if a is null or b is null then return; end if;
  update jar_slips set drawn_at = now() where jar_slips.id in (a, b);
  return query select s.id, s.author, s.body from jar_slips s where s.id in (a, b);
end;
$$;
revoke all on function public.draw_from_jar() from public, anon;
grant execute on function public.draw_from_jar() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'letters') then
      alter publication supabase_realtime add table letters;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'jar_slips') then
      alter publication supabase_realtime add table jar_slips;
    end if;
  end if;
end $$;

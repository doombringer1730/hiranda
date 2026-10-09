-- 039: A free week of Plus, no card needed, and the one-time Plus intro.
--
-- plus_trials: one free trial per couple, ever. start_plus_trial() opens it
-- for seven days if the couple has never had a trial and doesn't already have
-- Plus. It simply ends: nothing renews and nothing is charged.
-- couple_has_plus() now also counts a running trial. Trials live in their own
-- table, not couple_plus, so they never get in the way of a real subscription
-- recorded later by Stripe or Apple.
--
-- plus_intro_seen: you've seen the "here's Plus" welcome, so it never comes
-- back, on any device.
--
-- Safe to re-run.

create table if not exists plus_trials (
  couple_id   uuid primary key references couple(id) on delete cascade,
  started_by  uuid references auth.users on delete set null,
  started_at  timestamptz not null default now(),
  ends_at     timestamptz not null
);
alter table plus_trials enable row level security;
drop policy if exists "Couple members see their trial" on plus_trials;
create policy "Couple members see their trial" on plus_trials for select using (
  exists (select 1 from couple c where c.id = plus_trials.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
revoke insert, update, delete on plus_trials from authenticated, anon;

create table if not exists plus_intro_seen (
  user_id  uuid primary key references auth.users on delete cascade,
  seen_at  timestamptz not null default now()
);
alter table plus_intro_seen enable row level security;
drop policy if exists "Your own intro" on plus_intro_seen;
create policy "Your own intro" on plus_intro_seen for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.couple_has_plus()
returns boolean
language sql
stable
security definer
set search_path = public
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
revoke all on function public.couple_has_plus() from public, anon;
grant execute on function public.couple_has_plus() to authenticated;

-- Start the couple's free week. Returns when it ends, or null when there's no
-- trial to give (not paired, already Plus, or a trial was used before).
create or replace function public.start_plus_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public
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
revoke all on function public.start_plus_trial() from public, anon;
grant execute on function public.start_plus_trial() to authenticated;

-- 2FA, like every other table (see 021).
do $$
declare t text;
begin
  foreach t in array array['plus_trials', 'plus_intro_seen'] loop
    execute format('drop policy if exists "Require 2FA when enabled" on public.%I', t);
    execute format('create policy "Require 2FA when enabled" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

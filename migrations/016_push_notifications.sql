-- 016: Push notifications.
--
-- One row per device that opted in (a browser push subscription). Users manage
-- only their own rows. To notify a partner, the server calls
-- partner_push_subscriptions(), a security-definer function that returns the
-- caller's partner's devices — so no service-role key is needed and nobody can
-- list arbitrary subscriptions. prune_partner_push_subscription() removes a
-- partner device the push service reports as gone (404/410).
--
-- Safe to re-run.

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;

drop policy if exists "Users read their own push subscriptions" on push_subscriptions;
create policy "Users read their own push subscriptions" on push_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "Users add their own push subscriptions" on push_subscriptions;
create policy "Users add their own push subscriptions" on push_subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "Users update their own push subscriptions" on push_subscriptions;
create policy "Users update their own push subscriptions" on push_subscriptions
  for update using (auth.uid() = user_id);
drop policy if exists "Users remove their own push subscriptions" on push_subscriptions;
create policy "Users remove their own push subscriptions" on push_subscriptions
  for delete using (auth.uid() = user_id);

create or replace function public.partner_push_subscriptions()
returns table (endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = public
stable
as $$
  select s.endpoint, s.p256dh, s.auth
  from push_subscriptions s
  join couple c on (c.user1_id = auth.uid() and s.user_id = c.user2_id)
                or (c.user2_id = auth.uid() and s.user_id = c.user1_id);
$$;

create or replace function public.prune_partner_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subscriptions s
  using couple c
  where s.endpoint = p_endpoint
    and ((c.user1_id = auth.uid() and s.user_id = c.user2_id)
      or (c.user2_id = auth.uid() and s.user_id = c.user1_id));
$$;

revoke all on function public.partner_push_subscriptions() from public, anon;
revoke all on function public.prune_partner_push_subscription(text) from public, anon;
grant execute on function public.partner_push_subscriptions() to authenticated;
grant execute on function public.prune_partner_push_subscription(text) to authenticated;

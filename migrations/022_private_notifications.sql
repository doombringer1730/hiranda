-- 022: Private notifications.
--
-- Per-device "Hide details on lock screen": when on, that device gets a
-- generic "Something new on Hiranda" instead of the real title/body (no
-- partner name, no journal or memory titles). The owner sets it from
-- Settings; partner_push_subscriptions() now returns the flag so the server
-- can pick the right text per device.
--
-- Safe to re-run.

alter table push_subscriptions add column if not exists private boolean not null default false;

drop function if exists public.partner_push_subscriptions();
create function public.partner_push_subscriptions()
returns table (endpoint text, p256dh text, auth text, private boolean)
language sql
security definer
set search_path = public
stable
as $$
  select s.endpoint, s.p256dh, s.auth, s.private
  from push_subscriptions s
  join couple c on (c.user1_id = auth.uid() and s.user_id = c.user2_id)
                or (c.user2_id = auth.uid() and s.user_id = c.user1_id);
$$;
revoke all on function public.partner_push_subscriptions() from public, anon;
grant execute on function public.partner_push_subscriptions() to authenticated;

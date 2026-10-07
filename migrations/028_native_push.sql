-- 028: Native push for the iPhone app (APNs).
--
-- One row per iPhone that turned notifications on, holding its APNs device
-- token. Same shape of access as push_subscriptions (016): you manage your own
-- devices; the server reaches your partner's only through security-definer
-- functions. A device that switches accounts moves its token to the new owner
-- (register_native_push_token), so a phone never notifies the wrong person.
--
-- Safe to re-run.

create table if not exists native_push_tokens (
  token       text primary key check (token ~ '^[0-9a-f]{64,200}$'),
  user_id     uuid not null references auth.users on delete cascade,
  platform    text not null default 'ios' check (platform in ('ios')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists native_push_tokens_user on native_push_tokens (user_id);
alter table native_push_tokens enable row level security;

drop policy if exists "Users read their own native push tokens" on native_push_tokens;
create policy "Users read their own native push tokens" on native_push_tokens
  for select using (auth.uid() = user_id);
drop policy if exists "Users remove their own native push tokens" on native_push_tokens;
create policy "Users remove their own native push tokens" on native_push_tokens
  for delete using (auth.uid() = user_id);
-- Inserts go through register_native_push_token() only.

-- 2FA, like every other table (see 021).
drop policy if exists "Require 2FA when enabled" on public.native_push_tokens;
create policy "Require 2FA when enabled" on public.native_push_tokens as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Claim this device's token for the caller (moving it off any previous account).
create or replace function public.register_native_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
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
revoke all on function public.register_native_push_token(text) from public, anon;
grant execute on function public.register_native_push_token(text) to authenticated;

-- The caller's partner's iPhones (for notifyPartner).
create or replace function public.partner_native_push_tokens()
returns table (token text)
language sql
stable
security definer
set search_path = public
as $$
  select t.token
    from native_push_tokens t
    join couple c on (c.user1_id = auth.uid() and c.user2_id = t.user_id)
                  or (c.user2_id = auth.uid() and c.user1_id = t.user_id)
$$;
revoke all on function public.partner_native_push_tokens() from public, anon;
grant execute on function public.partner_native_push_tokens() to authenticated;

-- Forget a partner's token that APNs says is gone.
create or replace function public.prune_partner_native_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from native_push_tokens t
   using couple c
   where t.token = p_token
     and ((c.user1_id = auth.uid() and c.user2_id = t.user_id)
       or (c.user2_id = auth.uid() and c.user1_id = t.user_id))
$$;
revoke all on function public.prune_partner_native_push_token(text) from public, anon;
grant execute on function public.prune_partner_native_push_token(text) to authenticated;

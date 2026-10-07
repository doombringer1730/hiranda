-- 030: The Hiranda Store — send each other gifts.
--
-- store_addresses: where gifts to you are delivered. Only you can read or
-- change yours; your partner can ask whether you have one (so they can send
-- you something) but never sees it. The server reads it with the service
-- role when fulfilling an order.
--
-- store_orders: a gift from one partner to the other. The sender creates it
-- (as 'pending') when checkout starts; only the server (payment webhook,
-- fulfilment) moves it on. The sender sees their orders in full. The
-- recipient sees gifts on their way through incoming_gifts() — what and
-- from whom, never the price.
--
-- Safe to re-run.

create table if not exists store_addresses (
  user_id      uuid primary key references auth.users on delete cascade,
  full_name    text not null check (char_length(full_name) between 1 and 120),
  line1        text not null check (char_length(line1) between 1 and 200),
  line2        text check (char_length(line2) <= 200),
  city         text not null check (char_length(city) between 1 and 120),
  region       text check (char_length(region) <= 120),
  postal_code  text not null check (char_length(postal_code) between 1 and 20),
  country      text not null default 'US' check (country ~ '^[A-Z]{2}$'),
  phone        text check (char_length(phone) <= 40),
  updated_at   timestamptz not null default now()
);
alter table store_addresses enable row level security;
drop policy if exists "Your own gift address" on store_addresses;
create policy "Your own gift address" on store_addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists store_orders (
  id                 uuid primary key default gen_random_uuid(),
  couple_id          uuid not null references couple(id) on delete cascade,
  sender_id          uuid not null references auth.users on delete cascade,
  recipient_id       uuid not null references auth.users on delete cascade,
  product_key        text not null check (char_length(product_key) <= 60),
  title              text not null check (char_length(title) <= 120),
  note               text check (char_length(note) <= 300),
  amount_cents       integer not null check (amount_cents > 0),
  currency           text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  status             text not null default 'pending'
                     check (status in ('pending', 'paid', 'fulfilling', 'shipped', 'delivered', 'canceled', 'refunded')),
  stripe_session_id  text unique,
  tracking_url       text check (char_length(tracking_url) <= 500),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists store_orders_couple on store_orders (couple_id, created_at desc);
alter table store_orders enable row level security;

drop policy if exists "Senders see their gifts" on store_orders;
create policy "Senders see their gifts" on store_orders for select using (sender_id = auth.uid());

-- You can only start a gift to your own partner, and only as 'pending'.
drop policy if exists "Start a gift for your partner" on store_orders;
create policy "Start a gift for your partner" on store_orders for insert with check (
  sender_id = auth.uid()
  and status = 'pending'
  and stripe_session_id is null
  and tracking_url is null
  and exists (select 1 from couple c where c.id = store_orders.couple_id
    and ((c.user1_id = auth.uid() and c.user2_id = store_orders.recipient_id)
      or (c.user2_id = auth.uid() and c.user1_id = store_orders.recipient_id))));
-- No update/delete policies: the server moves orders along.

do $$
declare t text;
begin
  foreach t in array array['store_addresses', 'store_orders'] loop
    execute format('drop policy if exists "Require 2FA when enabled" on public.%I', t);
    execute format('create policy "Require 2FA when enabled" on public.%I as restrictive for all to authenticated using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t);
  end loop;
end $$;

-- Can I send my partner a physical gift? (Yes/no only — never the address.)
create or replace function public.partner_has_gift_address()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from store_addresses a
      join couple c on (c.user1_id = auth.uid() and c.user2_id = a.user_id)
                    or (c.user2_id = auth.uid() and c.user1_id = a.user_id)
  )
$$;
revoke all on function public.partner_has_gift_address() from public, anon;
grant execute on function public.partner_has_gift_address() to authenticated;

-- Gifts on their way to me: what, from whom, and where it's at — no price.
create or replace function public.incoming_gifts()
returns table (id uuid, sender_id uuid, title text, note text, status text, tracking_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.sender_id, o.title, o.note, o.status, o.tracking_url, o.created_at
    from store_orders o
   where o.recipient_id = auth.uid()
     and o.status in ('paid', 'fulfilling', 'shipped', 'delivered')
   order by o.created_at desc
   limit 20
$$;
revoke all on function public.incoming_gifts() from public, anon;
grant execute on function public.incoming_gifts() to authenticated;

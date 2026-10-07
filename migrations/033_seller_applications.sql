-- 033: "Sell on Hiranda" — businesses apply to sell in the Hiranda Store.
--
-- Applications come from the public /sell page (anyone, signed in or not)
-- and are written and read only by the server with the service role: there
-- are no policies, so no user can read or change them through the API.
-- The owner reviews them at /store/admin/sellers.
--
-- Safe to re-run.

create table if not exists seller_applications (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  business_name  text not null check (char_length(business_name) between 1 and 120),
  contact_name   text not null check (char_length(contact_name) between 1 and 120),
  email          text not null check (char_length(email) between 3 and 200),
  website        text check (char_length(website) <= 300),
  what_you_sell  text not null check (char_length(what_you_sell) between 1 and 1000),
  price_range    text check (char_length(price_range) <= 40),
  ships_from     text check (char_length(ships_from) <= 120),
  user_id        uuid references auth.users on delete set null,
  ip_hash        text check (char_length(ip_hash) <= 64),
  status         text not null default 'new' check (status in ('new', 'contacted', 'approved', 'declined')),
  admin_note     text check (char_length(admin_note) <= 1000)
);
create index if not exists seller_applications_created on seller_applications (created_at desc);
create index if not exists seller_applications_ip on seller_applications (ip_hash, created_at desc);
alter table seller_applications enable row level security;
-- (No policies on purpose — server only.)

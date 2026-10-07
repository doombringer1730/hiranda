-- 034: Store products you add from /store/admin/catalog (e.g. popular gifts
-- from CJ Dropshipping), alongside the built-in ones in lib/store/catalog.ts.
--
-- Server only: RLS on, no policies. The Store page reads it with the service
-- role and shows shoppers just the public fields — never cost_cents.
--
-- Safe to re-run.

create table if not exists store_products (
  key          text primary key check (key ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  title        text not null check (char_length(title) between 1 and 120),
  blurb        text not null default '' check (char_length(blurb) <= 300),
  image_url    text check (image_url ~ '^https://' and char_length(image_url) <= 500),
  emoji        text not null default '🎁' check (char_length(emoji) <= 16),
  category     text not null default 'gift' check (category in ('cuddly', 'jewelry', 'cozy', 'gift', 'keepsake')),
  price_cents  integer not null check (price_cents between 100 and 100000),
  cost_cents   integer check (cost_cents >= 0),
  vendor       jsonb not null,
  delivery     text check (char_length(delivery) <= 80),
  source_ref   text check (char_length(source_ref) <= 120),
  active       boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists store_products_active on store_products (active, category, sort);
alter table store_products enable row level security;
-- (No policies on purpose — server only.)

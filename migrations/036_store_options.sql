-- 036: Sizes (and other options) for Store gifts.
--
-- store_products.options: e.g. {"name":"Size","values":[{"label":"M","vid":"…"}]}
--   — vid (CJ) picks the exact variant; partner products just pass the label on.
-- store_orders.option: what the sender picked, e.g. "M". The server checks it
--   against the product before checkout.
--
-- Safe to re-run.

alter table store_products add column if not exists options jsonb;
alter table store_orders add column if not exists option text
  check (char_length(option) <= 60);

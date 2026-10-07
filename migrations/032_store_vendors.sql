-- 032: Store suppliers — paid gifts go straight to a print/gift partner
-- (Gelato, CJ Dropshipping, Goody) instead of being shipped by hand.
--
-- vendor / vendor_order_id: who's making the gift and their order id, set by
-- the server (service role) once the order is handed over. vendor_error: why
-- the hand-over failed, so the owner can retry from /store/admin.
-- Senders still can't set any of these: the insert policy now requires them
-- to be empty.
--
-- Safe to re-run.

alter table store_orders add column if not exists vendor text
  check (vendor in ('gelato', 'cj', 'goody'));
alter table store_orders add column if not exists vendor_order_id text
  check (char_length(vendor_order_id) <= 120);
alter table store_orders add column if not exists vendor_error text
  check (char_length(vendor_error) <= 500);
create unique index if not exists store_orders_vendor_ref
  on store_orders (vendor, vendor_order_id) where vendor_order_id is not null;

drop policy if exists "Start a gift for your partner" on store_orders;
create policy "Start a gift for your partner" on store_orders for insert with check (
  sender_id = auth.uid()
  and status = 'pending'
  and stripe_session_id is null
  and tracking_url is null
  and vendor is null
  and vendor_order_id is null
  and vendor_error is null
  and exists (select 1 from couple c where c.id = store_orders.couple_id
    and ((c.user1_id = auth.uid() and c.user2_id = store_orders.recipient_id)
      or (c.user2_id = auth.uid() and c.user1_id = store_orders.recipient_id))));

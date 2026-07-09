-- 008: Coupon shop — spend coins on "partner has to…" coupons.
--
-- A coupon is bought by one partner (coins deducted) and obligates the OTHER
-- partner to do it; the buyer redeems it when it's fulfilled. Couple-scoped.

create table coupons (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  emoji       text,
  cost        integer not null default 0,
  bought_by   uuid not null references auth.users on delete cascade,
  redeemed    boolean not null default false,
  redeemed_at timestamptz,
  created_at  timestamptz default now()
);
create index coupons_buyer_idx on coupons (bought_by);
alter table coupons enable row level security;

create policy "Couple members can read coupons" on coupons for select using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = coupons.bought_by or c.user2_id = coupons.bought_by)));
create policy "Users buy their own coupons" on coupons for insert with check (auth.uid() = bought_by);
create policy "Couple members can update coupons" on coupons for update using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = coupons.bought_by or c.user2_id = coupons.bought_by)));
create policy "Couple members can delete coupons" on coupons for delete using (
  exists (select 1 from couple c where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    and (c.user1_id = coupons.bought_by or c.user2_id = coupons.bought_by)));

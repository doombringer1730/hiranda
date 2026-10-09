-- 040: A customizable Home screen.
--
-- home_layouts: the widgets on your Home screen, in order, with their sizes.
-- One layout per couple, so you both see the same Home, and either of you can
-- rearrange it. The app keeps the shape in check (src/lib/home-widgets.ts);
-- here we only make sure it's a short list.
--
-- Arranging Home is a Plus feature: only a couple with Plus can save a
-- layout. If Plus ends, the layout stays saved and comes back with Plus;
-- meanwhile Home shows the default.
--
-- profiles.time_zone: each of you, as your phone last reported it, so the
-- Clocks widget can show both of your times.
--
-- Until this runs, Home simply shows the default layout.
--
-- Safe to re-run.

create table if not exists home_layouts (
  couple_id   uuid primary key references couple(id) on delete cascade,
  layout      jsonb not null check (jsonb_typeof(layout) = 'array' and jsonb_array_length(layout) <= 40),
  updated_by  uuid references auth.users on delete set null,
  updated_at  timestamptz not null default now()
);
alter table home_layouts enable row level security;

drop policy if exists "Couple members see their home" on home_layouts;
create policy "Couple members see their home" on home_layouts for select using (
  exists (select 1 from couple c where c.id = home_layouts.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Couple members set up their home" on home_layouts;
create policy "Couple members set up their home" on home_layouts for insert with check (
  updated_by = auth.uid()
  and public.couple_has_plus()
  and exists (select 1 from couple c where c.id = home_layouts.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Couple members rearrange their home" on home_layouts;
create policy "Couple members rearrange their home" on home_layouts for update using (
  exists (select 1 from couple c where c.id = home_layouts.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())))
  with check (
  updated_by = auth.uid()
  and public.couple_has_plus()
  and exists (select 1 from couple c where c.id = home_layouts.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Require 2FA when enabled" on home_layouts;
create policy "Require 2FA when enabled" on home_layouts as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

revoke all on home_layouts from anon;
revoke delete on home_layouts from authenticated;
grant select, insert, update on home_layouts to authenticated;

-- ── Time zones for the Clocks widget ──
alter table profiles add column if not exists time_zone text check (char_length(time_zone) <= 64);
grant select (time_zone) on public.profiles to authenticated;

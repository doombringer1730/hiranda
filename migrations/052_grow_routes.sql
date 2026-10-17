-- 052: Opening a hard-topic route on the Grow map together.
--
-- Fighting fair, Money talk and Our people only open when one of you suggests
-- it and the other says yes (mutual opt-in, like the deeper question decks).
-- One row per couple and route: who suggested it, and who said yes.
-- "Not yet" deletes the suggestion: no record, no reminder.
--
-- Rules: both of you can see your couple's rows; you can suggest (insert)
-- only as yourself and only unanswered; only the OTHER partner can say yes
-- (update accepted_by to themselves); either of you can withdraw or decline
-- (delete). Only accepted_by / accepted_at can ever be updated.
--
-- Safe to re-run.

create table if not exists grow_routes (
  couple_id    uuid not null references couple(id) on delete cascade,
  route_key    text not null check (char_length(route_key) <= 24),
  proposed_by  uuid not null references auth.users on delete cascade,
  proposed_at  timestamptz not null default now(),
  accepted_by  uuid references auth.users on delete cascade,
  accepted_at  timestamptz,
  primary key (couple_id, route_key)
);
alter table grow_routes enable row level security;

drop policy if exists "Couple members see their routes" on grow_routes;
create policy "Couple members see their routes" on grow_routes for select to authenticated using (
  exists (select 1 from couple c where c.id = grow_routes.couple_id
    and (c.user1_id = (select auth.uid()) or c.user2_id = (select auth.uid())))
);

drop policy if exists "Suggest a route" on grow_routes;
create policy "Suggest a route" on grow_routes for insert to authenticated with check (
  proposed_by = (select auth.uid()) and accepted_by is null and accepted_at is null
  and exists (select 1 from couple c where c.id = grow_routes.couple_id
    and (c.user1_id = (select auth.uid()) or c.user2_id = (select auth.uid())))
);

drop policy if exists "Say yes to their suggestion" on grow_routes;
create policy "Say yes to their suggestion" on grow_routes for update to authenticated
  using (
    proposed_by <> (select auth.uid()) and accepted_by is null
    and exists (select 1 from couple c where c.id = grow_routes.couple_id
      and (c.user1_id = (select auth.uid()) or c.user2_id = (select auth.uid())))
  )
  with check (accepted_by = (select auth.uid()) and proposed_by <> (select auth.uid()));

drop policy if exists "Withdraw or not yet" on grow_routes;
create policy "Withdraw or not yet" on grow_routes for delete to authenticated using (
  accepted_by is null
  and exists (select 1 from couple c where c.id = grow_routes.couple_id
    and (c.user1_id = (select auth.uid()) or c.user2_id = (select auth.uid())))
);

-- Only the "yes" columns can change.
revoke update on grow_routes from authenticated;
grant update (accepted_by, accepted_at) on grow_routes to authenticated;
revoke all on grow_routes from anon;

drop policy if exists "Require 2FA when enabled" on grow_routes;
create policy "Require 2FA when enabled" on grow_routes as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

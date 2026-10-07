-- 029: Hiranda Plus — one subscription per couple.
--
-- couple_plus holds the couple's current entitlement, whatever paid for it:
-- Apple in-app purchase (via RevenueCat), Stripe on the web, or a manual
-- grant. Both partners can read it; nobody can write it from the app —
-- only the payment webhooks, with the service role. couple_has_plus() is the
-- one check everything else uses.
--
-- Safe to re-run.

create table if not exists couple_plus (
  couple_id           uuid primary key references couple(id) on delete cascade,
  source              text not null check (source in ('apple', 'stripe', 'grant')),
  status              text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  product             text,
  current_period_end  timestamptz,           -- null = no end (grants)
  external_id         text,                  -- Stripe customer id / RevenueCat app user id
  updated_at          timestamptz not null default now()
);
alter table couple_plus enable row level security;

drop policy if exists "Couple members see their Plus" on couple_plus;
create policy "Couple members see their Plus" on couple_plus for select using (
  exists (select 1 from couple c where c.id = couple_plus.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));
-- No insert/update/delete policies: writes come from webhooks (service role).

drop policy if exists "Require 2FA when enabled" on public.couple_plus;
create policy "Require 2FA when enabled" on public.couple_plus as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Does the caller's couple have Plus right now?
create or replace function public.couple_has_plus()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from couple_plus p
      join couple c on c.id = p.couple_id
     where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
       and p.status in ('active', 'trialing', 'past_due')
       and (p.current_period_end is null or p.current_period_end > now())
  )
$$;
revoke all on function public.couple_has_plus() from public, anon;
grant execute on function public.couple_has_plus() to authenticated;

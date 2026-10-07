-- 037: Your sizes, for gifts that need one (pajamas, hoodies…).
--
-- Like your delivery address: only you can read or change them. Your partner
-- can ask *which kinds* you've saved (so the Store can say "we'll use their
-- size"), never the sizes themselves. The server reads them with the service
-- role when a gift is ordered.
--
-- Safe to re-run.

create table if not exists gift_sizes (
  user_id     uuid primary key references auth.users on delete cascade,
  top         text check (char_length(top) <= 10),
  bottom      text check (char_length(bottom) <= 10),
  shoe        text check (char_length(shoe) <= 10),
  updated_at  timestamptz not null default now()
);
alter table gift_sizes enable row level security;
drop policy if exists "Your own sizes" on gift_sizes;
create policy "Your own sizes" on gift_sizes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Require 2FA when enabled" on gift_sizes;
create policy "Require 2FA when enabled" on gift_sizes as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- Which of my partner's sizes are saved — kinds only, never the values.
create or replace function public.partner_size_kinds()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select array_remove(array[
        case when s.top is not null then 'top' end,
        case when s.bottom is not null then 'bottom' end,
        case when s.shoe is not null then 'shoe' end], null)
      from gift_sizes s
      join couple c on (c.user1_id = auth.uid() and c.user2_id = s.user_id)
                    or (c.user2_id = auth.uid() and c.user1_id = s.user_id)
      limit 1), '{}')
$$;
revoke all on function public.partner_size_kinds() from public, anon;
grant execute on function public.partner_size_kinds() to authenticated;

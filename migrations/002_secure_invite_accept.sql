-- 002: Require the invite token to claim a couple's open slot.
--
-- The old "Authenticated user can accept invite" RLS policy allowed ANY
-- signed-in user to PATCH any couple with a free slot (user2_id is null)
-- straight through PostgREST — no invite token required — and install
-- themselves as the partner (and touch other columns on that row).
--
-- The app already joins via rpc('accept_invite', ...), so we make that
-- function SECURITY DEFINER (it no longer needs a permissive policy),
-- validate the token inside it, and drop the policy.

create or replace function public.accept_invite(token text, new_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed int;
begin
  -- Callers may only claim a spot for themselves, and must be signed in.
  if auth.uid() is null or new_user_id is distinct from auth.uid() then
    return false;
  end if;

  update couple
     set user2_id = new_user_id
   where invite_token = accept_invite.token
     and user2_id is null
     and user1_id <> new_user_id;

  get diagnostics claimed = row_count;
  return claimed = 1;
exception
  -- user2_id is unique across couples: joining a second space fails here
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.accept_invite(text, uuid) from public, anon;
grant execute on function public.accept_invite(text, uuid) to authenticated;

drop policy if exists "Authenticated user can accept invite" on couple;

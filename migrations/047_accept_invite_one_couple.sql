-- 047: accept_invite() keeps everyone in exactly one couple.
--
-- Two gaps left after 046:
--
-- 1. Someone already in a PAIRED couple could accept a second invite. 014
--    only discards the caller's empty shell, and the unique constraints don't
--    stop a user1 of a paired couple becoming user2 somewhere else, so they
--    ended up in two couples (the app then picks one of them at random, and
--    the storage policies let them read both partners' uploads). Now an
--    invite can only be accepted by someone with no partner yet.
--
-- 2. Two people accepting the same invite at once: the slower one's update
--    found the slot taken (0 rows) and returned false, but its delete of
--    their own solo space had already gone through. Now a lost claim raises
--    inside the block, so the delete is rolled back with it.
--
-- Otherwise the same as 045 (paired_at is still stamped).
--
-- Safe to re-run.

create or replace function public.accept_invite(token text, new_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  -- Callers may only claim a spot for themselves, and must be signed in.
  if auth.uid() is null or new_user_id is distinct from auth.uid() then
    return false;
  end if;

  -- Already partnered (on either side): one couple per person.
  if exists (select 1 from couple
              where (user1_id = new_user_id or user2_id = new_user_id)
                and user2_id is not null) then
    return false;
  end if;

  -- Resolve the invite before discarding anything of the caller's.
  select id into target_id
    from couple
   where invite_token = accept_invite.token
     and user2_id is null
     and user1_id <> new_user_id;

  if target_id is null then
    return false;
  end if;

  begin
    delete from couple
     where user1_id = new_user_id
       and user2_id is null;

    update couple
       set user2_id = new_user_id,
           paired_at = now()
     where id = target_id
       and user2_id is null;

    -- Someone else claimed it first: undo the delete above too.
    if not found then
      raise exception 'invite already claimed' using errcode = 'HR001';
    end if;
  exception
    -- user2_id is unique across couples: already partnered elsewhere. Either
    -- way the handler rolls this block back, so the delete is undone.
    when unique_violation or sqlstate 'HR001' then
      return false;
  end;

  return true;
end;
$$;

revoke all on function public.accept_invite(text, uuid) from public, anon;
grant execute on function public.accept_invite(text, uuid) to authenticated;

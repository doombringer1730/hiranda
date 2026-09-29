-- 014: Let someone who already made their own (unpaired) space accept an invite.
--
-- Background: /join/<token> used to be gated by the auth middleware, so a
-- signed-out invitee got bounced to /login and the token was dropped. Plenty
-- of them then picked "Start a new couple space" and ended up as user1 of an
-- empty couple of their own.
--
-- Nothing stopped such a user from ALSO becoming user2 of a real couple
-- (user1_id and user2_id are separately unique), and being in two couples
-- breaks the app: the `(app)` layout looks the membership up with
-- .maybeSingle(), which errors on two rows and bounces the user to
-- /invite-partner forever.
--
-- So: when the caller owns an unpaired couple, joining someone else's space
-- discards that empty shell first. Only ever a couple where the caller is
-- user1 AND user2_id is null — a paired space is never touched.

create or replace function public.accept_invite(token text, new_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  claimed   int;
begin
  -- Callers may only claim a spot for themselves, and must be signed in.
  if auth.uid() is null or new_user_id is distinct from auth.uid() then
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
       set user2_id = new_user_id
     where id = target_id
       and user2_id is null;

    get diagnostics claimed = row_count;
  exception
    -- user2_id is unique across couples: already partnered elsewhere. The
    -- handler rolls this block back, so the delete above is undone too.
    when unique_violation then
      return false;
  end;

  return claimed = 1;
end;
$$;

revoke all on function public.accept_invite(text, uuid) from public, anon;
grant execute on function public.accept_invite(text, uuid) to authenticated;

-- 042: When each couple actually paired up.
--
-- couple.created_at is when the first partner made the space, not when the
-- second one joined. paired_at is set by accept_invite() the moment an invite
-- is accepted, so you can see how many couples pair, and how long it takes:
--
--   select count(*) filter (where paired_at > now() - interval '7 days') as paired_this_week,
--          percentile_cont(0.5) within group (order by paired_at - created_at) as median_time_to_pair
--     from couple where paired_at is not null;
--
-- Couples that paired before this ran keep paired_at null: the real time
-- wasn't recorded, and guessing would skew the numbers.
--
-- The app can read it but never set it (couple UPDATE is granted per column
-- since 018, and this column isn't in the list).
--
-- Safe to re-run.

alter table couple add column if not exists paired_at timestamptz;

-- Same as 014, plus stamping paired_at.
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
       set user2_id = new_user_id,
           paired_at = now()
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

-- 053: Finishing a Grow map stop together, on one phone.
--
-- In "together" mode you pass one phone back and forth, so only one of you is
-- signed in. finish_together() marks the stop done for your partner too, right
-- after you've finished it yourself: it only works within 15 minutes of your
-- own finish, writes no note for them (their note stays theirs to write), and
-- never overwrites a stop they already finished. The app tells your partner it
-- happened, so they always know. Returns true once the stop is done for both.
--
-- It runs with owner rights (lesson_progress only lets you insert your own
-- rows), so it checks the couple and 2FA itself.
--
-- Safe to re-run.

create or replace function public.finish_together(p_key text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_couple uuid;
  v_partner uuid;
begin
  if v_me is null or not public.mfa_ok() then return false; end if;

  select c.id, case when c.user1_id = v_me then c.user2_id else c.user1_id end
    into v_couple, v_partner
    from couple c
   where c.user1_id = v_me or c.user2_id = v_me
   limit 1;
  if v_couple is null or v_partner is null then return false; end if;

  -- Only right after you finished it yourself.
  if not exists (
    select 1 from lesson_progress p
     where p.user_id = v_me and p.couple_id = v_couple and p.lesson_key = p_key
       and p.completed_at > now() - interval '15 minutes'
  ) then return false; end if;

  insert into lesson_progress (couple_id, user_id, lesson_key, note)
  values (v_couple, v_partner, p_key, null)
  on conflict (user_id, lesson_key) do nothing;
  return true;
end;
$$;
revoke all on function public.finish_together(text) from public, anon;
grant execute on function public.finish_together(text) to authenticated;

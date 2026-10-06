-- 020: Account deletion.
--
-- purge_user_data(target) removes everything a user created, in an order that
-- satisfies the foreign keys (several reference auth.users with NO ACTION, so
-- deleting the login alone would fail). It runs in one transaction: either
-- all of it happens or none of it does. The partner keeps their own content;
-- links from their items to the deleted user's memories are cleared, and
-- todos assigned to the deleted user become unassigned.
--
-- Only the service role may call it (the "Delete my account" server action,
-- which then deletes the auth user and their storage files).
--
-- Safe to re-run.

create or replace function public.purge_user_data(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Partner items that point at this user's content: unlink, don't delete.
  update bucket_list     set linked_memory_id = null where linked_memory_id in (select id from memories where created_by = target);
  update important_dates set linked_memory_id = null where linked_memory_id in (select id from memories where created_by = target);
  update todos           set assigned_to = null      where assigned_to = target and created_by <> target;
  update watch_sessions  set last_updated_by = created_by where last_updated_by = target and created_by <> target;

  -- Everything this user created.
  delete from watch_messages   where user_id = target;
  delete from watch_sessions   where created_by = target;
  delete from photos           where uploaded_by = target;
  delete from journal_photos   where uploaded_by = target;
  delete from memories         where created_by = target;
  delete from journal_entries  where created_by = target;
  delete from books            where uploaded_by = target;
  delete from reading_progress where user_id = target;
  delete from music_moments    where added_by = target;
  delete from watchlist        where added_by = target;
  delete from bucket_list      where created_by = target;
  delete from important_dates  where created_by = target;
  delete from todos            where created_by = target;
  delete from prompt_responses where user_id = target;
  delete from prompts          where created_by = target and is_stock is not true;
  -- The rest (profile, couple, games, study, coupons, trivia, love taps, push
  -- subscriptions) cascade when the auth user is deleted.
end;
$$;

revoke all on function public.purge_user_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;

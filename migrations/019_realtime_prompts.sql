-- 019: Live answers. Adds prompt_responses to the realtime publication so the
-- daily question and prompt games can reveal answers the moment a partner
-- replies, instead of polling every few seconds. Realtime enforces the
-- table's row-level security, so you only ever receive your couple's rows.
-- Safe to re-run.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'prompt_responses') then
    alter publication supabase_realtime add table prompt_responses;
  end if;
end $$;

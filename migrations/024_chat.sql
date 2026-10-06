-- 024: Chat — a private conversation for the two of you.
--
-- One row per message. Couple members can read their couple's messages;
-- you can only send as yourself, in your own couple. The *recipient* may
-- set `reaction` and `read_at` (column grants keep everything else
-- read-only); the sender may delete (unsend) their own message.
--
-- `kind` is 'text' or 'good_news' (shared wins get a celebration card and
-- reply suggestions in the app).
--
-- Safe to re-run.

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references couple(id) on delete cascade,
  sender      uuid not null references auth.users on delete cascade,
  kind        text not null default 'text' check (kind in ('text', 'good_news')),
  body        text not null check (char_length(body) between 1 and 4000),
  reaction    text check (reaction in ('❤️', '😂', '😮', '😢', '👍', '🔥')),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists messages_couple_idx on messages (couple_id, created_at desc);
alter table messages enable row level security;

drop policy if exists "Couple members can read messages" on messages;
create policy "Couple members can read messages" on messages for select using (
  exists (select 1 from couple c where c.id = messages.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Couple members send messages" on messages;
create policy "Couple members send messages" on messages for insert with check (
  sender = auth.uid()
  and exists (select 1 from couple c where c.id = messages.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Recipients react and mark read" on messages;
create policy "Recipients react and mark read" on messages for update using (
  sender <> auth.uid()
  and exists (select 1 from couple c where c.id = messages.couple_id
    and (c.user1_id = auth.uid() or c.user2_id = auth.uid())));

drop policy if exists "Senders unsend their own messages" on messages;
create policy "Senders unsend their own messages" on messages for delete using (sender = auth.uid());

drop policy if exists "Require 2FA when enabled" on messages;
create policy "Require 2FA when enabled" on messages as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

revoke all on messages from anon;
revoke insert, update on messages from authenticated;
grant select, delete on messages to authenticated;
grant insert (couple_id, sender, kind, body) on messages to authenticated;
grant update (reaction, read_at) on messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- 044: Who's inviting you.
--
-- invite_preview(token): the inviter's first name, photo and colour for an
-- unused invite link, so the partner who opens it sees "Sam saved you a
-- seat" (and the link preview in Messages says so too) before signing up.
-- Callable signed out; reveals nothing without the 32-character token, and
-- nothing at all once the invite has been used.
--
-- Until this runs, the welcome page simply says "your partner".
--
-- Safe to re-run.

create or replace function public.invite_preview(token text)
returns table (name text, avatar_url text, accent_color text)
language sql stable security definer set search_path = public as $$
  select nullif(split_part(trim(p.display_name), ' ', 1), ''), p.avatar_url, p.accent_color
    from couple c join profiles p on p.id = c.user1_id
   where c.invite_token = invite_preview.token and c.user2_id is null
   limit 1
$$;
revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

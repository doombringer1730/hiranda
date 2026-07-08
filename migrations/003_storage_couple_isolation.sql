-- 003: Per-couple isolation for storage objects.
--
-- CRITICAL FIX. Before this migration, any authenticated user could list AND
-- download every object in the private buckets (photos, videos, epubs) — a
-- full cross-tenant leak of other couples' private media. Verified 2026-07-08
-- by downloading another couple's photo with an unrelated fresh account.
--
-- Path convention (from the upload code): every private object is stored under
-- `<uploader_user_id>/...`, so the first path segment identifies the owner.
-- Read/manage is granted when that owner shares a couple with the caller;
-- writes are restricted to the caller's own folder.
--
-- `avatars` is a deliberately PUBLIC bucket (served via /object/public/avatars
-- on public profile pages); it stays world-readable but write-locked to self.

-- Reset: drop every existing policy on storage.objects so the resulting set is
-- exactly what's defined below (the old permissive policies had unknown names).
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- Make sure the private buckets are not marked public, and avatars is.
update storage.buckets set public = false where id in ('photos', 'videos', 'epubs');
update storage.buckets set public = true  where id = 'avatars';

-- Helper predicate, inlined per policy: owner (first folder segment) is in a
-- couple with the current user.
--   ((storage.foldername(name))[1])::uuid  =  the uploader's user id

-- ── photos / videos / epubs: couple-scoped read + manage ──
do $$
declare b text;
begin
  foreach b in array array['photos','videos','epubs'] loop
    execute format($f$
      create policy "Couple can read %1$s"
        on storage.objects for select to authenticated
        using (
          bucket_id = %1$L
          and exists (
            select 1 from public.couple c
            where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
              and (c.user1_id = ((storage.foldername(name))[1])::uuid
                   or c.user2_id = ((storage.foldername(name))[1])::uuid)
          )
        );
    $f$, b);

    -- Uploads must go into the caller's own folder.
    execute format($f$
      create policy "Owner can upload %1$s"
        on storage.objects for insert to authenticated
        with check (
          bucket_id = %1$L
          and ((storage.foldername(name))[1])::uuid = auth.uid()
        );
    $f$, b);

    -- Either partner may update/delete shared media in their couple.
    execute format($f$
      create policy "Couple can update %1$s"
        on storage.objects for update to authenticated
        using (
          bucket_id = %1$L
          and exists (
            select 1 from public.couple c
            where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
              and (c.user1_id = ((storage.foldername(name))[1])::uuid
                   or c.user2_id = ((storage.foldername(name))[1])::uuid)
          )
        );
    $f$, b);

    execute format($f$
      create policy "Couple can delete %1$s"
        on storage.objects for delete to authenticated
        using (
          bucket_id = %1$L
          and exists (
            select 1 from public.couple c
            where (c.user1_id = auth.uid() or c.user2_id = auth.uid())
              and (c.user1_id = ((storage.foldername(name))[1])::uuid
                   or c.user2_id = ((storage.foldername(name))[1])::uuid)
          )
        );
    $f$, b);
  end loop;
end $$;

-- ── avatars: public read, self-only write ──
create policy "Anyone can read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Owner can upload avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text);

create policy "Owner can update avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text);

create policy "Owner can delete avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text);

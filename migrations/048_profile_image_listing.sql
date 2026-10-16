-- 048: Nobody can list the avatars and banners buckets.
--
-- Avatar and banner files are named by user id, and "Anyone can read
-- avatars/banners" (003, 004) let anyone, even signed out, list the bucket and
-- collect every user's id.
--
-- Now a signed-in user can only see their own file through the API. That read
-- rule is still needed: the profile editor uploads with `upsert: true`, which
-- has to see the existing file to overwrite it. Images keep loading for
-- everyone because both buckets are public, and /object/public/ URLs don't go
-- through these rules.
--
-- Safe to re-run.

drop policy if exists "Anyone can read avatars" on storage.objects;
drop policy if exists "Anyone can read banners" on storage.objects;

drop policy if exists "Owner can read avatar" on storage.objects;
create policy "Owner can read avatar"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text);

drop policy if exists "Owner can read banner" on storage.objects;
create policy "Owner can read banner"
  on storage.objects for select to authenticated
  using (bucket_id = 'banners' and name = auth.uid()::text);

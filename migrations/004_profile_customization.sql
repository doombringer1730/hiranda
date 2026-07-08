-- 004: Profile customization — accent color + banner image.
--
-- Adds Discord-style profile fields and a public `banners` storage bucket that
-- mirrors the `avatars` bucket's policies (public read, self-only write, one
-- object per user named by their user id).

alter table profiles add column if not exists accent_color text;
alter table profiles add column if not exists banner_url text;

-- Public banners bucket (same shape as avatars).
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can read banners" on storage.objects;
drop policy if exists "Owner can upload banner" on storage.objects;
drop policy if exists "Owner can update banner" on storage.objects;
drop policy if exists "Owner can delete banner" on storage.objects;

create policy "Anyone can read banners"
  on storage.objects for select
  using (bucket_id = 'banners');

create policy "Owner can upload banner"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and name = auth.uid()::text);

create policy "Owner can update banner"
  on storage.objects for update to authenticated
  using (bucket_id = 'banners' and name = auth.uid()::text);

create policy "Owner can delete banner"
  on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and name = auth.uid()::text);

-- =====================================================================
-- Nerdy Town — migration 005: keep photo storage small.
-- The site now shrinks photos in the browser (WebP, ~200 KB + a ~30 KB
-- thumbnail). This caps uploads at 400 KB so nobody can upload around it,
-- and lets admins delete the photos of residents they remove.
-- Run ONCE in Supabase → SQL Editor (after 004). Safe to run twice.
-- =====================================================================

update storage.buckets
set file_size_limit = 409600, allowed_mime_types = array['image/jpeg', 'image/webp']
where id = 'photos';

drop policy if exists photos_admin_delete on storage.objects;
create policy photos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());

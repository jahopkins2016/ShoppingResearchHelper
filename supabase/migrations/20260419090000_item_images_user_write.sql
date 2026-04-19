-- Authenticated users need to upload captured in-store photos into the
-- item-images bucket. The bucket was created public-read only; the
-- enrich-item edge function writes with the service role key (bypasses RLS),
-- but the Flutter client writes as the signed-in user and hits the default
-- deny. Allow users to insert/update/delete objects under captures/<uid>/.

drop policy if exists "item_images_user_insert" on storage.objects;
create policy "item_images_user_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'item-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'captures'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "item_images_user_update" on storage.objects;
create policy "item_images_user_update" on storage.objects
  for update
  using (
    bucket_id = 'item-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'captures'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "item_images_user_delete" on storage.objects;
create policy "item_images_user_delete" on storage.objects
  for delete
  using (
    bucket_id = 'item-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'captures'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

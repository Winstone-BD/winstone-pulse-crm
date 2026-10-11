-- project-photos bucket is private; only signed-in staff may read objects (signed URLs are minted server-side)
create policy "Staff read project photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-photos');
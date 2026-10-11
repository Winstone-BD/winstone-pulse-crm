ALTER TABLE public.project_catalog ADD COLUMN IF NOT EXISTS image_url text;

CREATE POLICY "Public read project images"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');
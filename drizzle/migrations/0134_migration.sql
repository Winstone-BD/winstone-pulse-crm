CREATE OR REPLACE FUNCTION public.project_photos_exposure()
RETURNS TABLE(bucket_public boolean, policy_count integer, policy_names text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT
    coalesce((SELECT b.public FROM storage.buckets b WHERE b.id = 'project-photos'), false),
    (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects'
       AND (coalesce(p.qual,'') ILIKE '%project-photos%' OR coalesce(p.with_check,'') ILIKE '%project-photos%') AND p.cmd IN ('SELECT','ALL')),
    coalesce((SELECT array_agg(p.policyname) FROM pg_policies p WHERE p.schemaname='storage' AND p.tablename='objects'
       AND (coalesce(p.qual,'') ILIKE '%project-photos%' OR coalesce(p.with_check,'') ILIKE '%project-photos%') AND p.cmd IN ('SELECT','ALL')), ARRAY[]::text[])
$$;
REVOKE ALL ON FUNCTION public.project_photos_exposure() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_photos_exposure() TO service_role;
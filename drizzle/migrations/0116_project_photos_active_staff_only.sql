CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.user_id = _user_id AND p.is_active AND p.approval_status = 'approved'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_staff(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_active_staff(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated staff can view project photos" ON storage.objects;
CREATE POLICY "Active staff can view project photos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'project-photos' AND public.is_active_staff((select auth.uid())));
DROP POLICY IF EXISTS "staff can read the support admin list" ON public.team_support_admins;

CREATE POLICY "own row or admins read the support admin list"
  ON public.team_support_admins FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
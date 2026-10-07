DROP POLICY IF EXISTS "Signed-in users read article categories" ON public.support_article_categories;

CREATE POLICY "Support staff read article categories"
ON public.support_article_categories
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'team_leader')
);
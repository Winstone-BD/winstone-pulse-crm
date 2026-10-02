DROP POLICY IF EXISTS "Signed-in users read releases" ON public.app_releases;
CREATE POLICY "IT and HQ read releases" ON public.app_releases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Article categories are public" ON public.support_article_categories;
CREATE POLICY "Signed-in users read article categories" ON public.support_article_categories FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.support_article_categories FROM anon;
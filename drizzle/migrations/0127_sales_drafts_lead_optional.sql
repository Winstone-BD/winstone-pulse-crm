ALTER TABLE public.sales_drafts ALTER COLUMN lead_id DROP NOT NULL;
REVOKE ALL ON public.sales_drafts FROM anon, authenticated;
REVOKE ALL ON public.objection_answers FROM anon, authenticated;
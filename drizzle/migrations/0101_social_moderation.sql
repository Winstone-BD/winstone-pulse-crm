CREATE TABLE public.social_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'page' CHECK (kind IN ('page','group')),
  url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.social_pages TO service_role;
GRANT SELECT ON public.social_pages TO authenticated;
ALTER TABLE public.social_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in read active social pages" ON public.social_pages FOR SELECT TO authenticated USING (active);

CREATE TABLE public.social_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.social_reply_templates TO service_role;
GRANT SELECT ON public.social_reply_templates TO authenticated;
ALTER TABLE public.social_reply_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in read active templates" ON public.social_reply_templates FOR SELECT TO authenticated USING (active);

CREATE TABLE public.social_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  kind text NOT NULL CHECK (kind IN ('inbox','page_comment','group')),
  page_id uuid REFERENCES public.social_pages(id),
  link text,
  note text,
  reply_count integer NOT NULL DEFAULT 1 CHECK (reply_count BETWEEN 1 AND 500),
  lead_id uuid REFERENCES public.leads(id),
  voided_at timestamptz,
  voided_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX social_activity_agent_day_idx ON public.social_activity_logs (agent_id, created_at DESC);
GRANT ALL ON public.social_activity_logs TO service_role;
GRANT SELECT ON public.social_activity_logs TO authenticated;
ALTER TABLE public.social_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents read own social activity" ON public.social_activity_logs FOR SELECT TO authenticated
  USING (agent_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_social_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'social activity is append-only'; END IF;
  IF OLD.voided_at IS NOT NULL THEN RAISE EXCEPTION 'voided entry is final'; END IF;
  IF NEW.agent_id IS DISTINCT FROM OLD.agent_id OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.page_id IS DISTINCT FROM OLD.page_id OR NEW.link IS DISTINCT FROM OLD.link
     OR NEW.note IS DISTINCT FROM OLD.note OR NEW.reply_count IS DISTINCT FROM OLD.reply_count
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.lead_id IS NOT NULL AND NEW.lead_id IS DISTINCT FROM OLD.lead_id) THEN
    RAISE EXCEPTION 'only void or first lead link may change';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER social_activity_append_only BEFORE UPDATE OR DELETE ON public.social_activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.protect_social_activity();
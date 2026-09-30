CREATE TABLE public.market_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('daily_market','finance_loan','area_price','regulatory','project_property')),
  geography text,
  metric text NOT NULL,
  value text NOT NULL,
  unit text,
  source_name text NOT NULL,
  source_url text,
  effective_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','verified','published','expired')),
  verified_by text,
  verified_at timestamptz,
  created_by text NOT NULL,
  review_date date,
  expiry_date date,
  version integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.market_facts TO service_role;
ALTER TABLE public.market_facts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER market_facts_touch BEFORE UPDATE ON public.market_facts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.pitch_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objection_code text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','verified','published','expired')),
  version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pitch_templates TO service_role;
ALTER TABLE public.pitch_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pitch_templates_touch BEFORE UPDATE ON public.pitch_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL CHECK (entity IN ('market_fact','pitch_template')),
  entity_id uuid NOT NULL,
  version integer NOT NULL,
  action text NOT NULL,
  snapshot jsonb NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.knowledge_versions TO service_role;
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX knowledge_versions_entity_idx ON public.knowledge_versions(entity, entity_id, created_at);
CREATE TRIGGER knowledge_versions_immutable BEFORE UPDATE OR DELETE ON public.knowledge_versions FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();

CREATE TABLE public.pitch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  call_id uuid,
  follow_up_id uuid,
  objection_code text NOT NULL,
  template_id uuid REFERENCES public.pitch_templates(id),
  action text NOT NULL CHECK (action IN ('viewed','copied','edited','whatsapp_opened','saved')),
  generated_text text,
  final_text text,
  project text,
  fact_ids uuid[] NOT NULL DEFAULT '{}',
  ai_grounded boolean NOT NULL DEFAULT false,
  correlation_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pitch_events TO service_role;
ALTER TABLE public.pitch_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX pitch_events_lead_idx ON public.pitch_events(lead_id, created_at);
CREATE INDEX pitch_events_agent_idx ON public.pitch_events(agent_id, created_at);
CREATE INDEX pitch_events_created_idx ON public.pitch_events(created_at, id);
CREATE TRIGGER pitch_events_immutable BEFORE UPDATE OR DELETE ON public.pitch_events FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();
ALTER TABLE public.site_visits
  ADD COLUMN IF NOT EXISTS team_calendar_event_id text,
  ADD COLUMN IF NOT EXISTS team_calendar_added_at timestamptz,
  ADD COLUMN IF NOT EXISTS team_calendar_added_by text;

CREATE TABLE public.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_key text NOT NULL UNIQUE,
  item_no text NOT NULL,
  title text NOT NULL,
  result text NOT NULL,
  evidence text NOT NULL,
  audit_date text NOT NULL,
  audit_commit text NOT NULL,
  doc_version text NOT NULL,
  captured_by text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.audit_findings TO service_role;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_remediation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_key text NOT NULL REFERENCES public.audit_findings(finding_key),
  action text NOT NULL CHECK (action IN ('noted','in_progress','fixed','verified','reopened','wont_fix')),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1000),
  actor_name text NOT NULL,
  actor_scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_remediation_events_key_idx ON public.audit_remediation_events (finding_key, created_at);
GRANT ALL ON public.audit_remediation_events TO service_role;
ALTER TABLE public.audit_remediation_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.block_audit_record_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'Audit findings and remediation history are append-only'; END $$;

CREATE TRIGGER audit_findings_immutable BEFORE UPDATE OR DELETE ON public.audit_findings
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_record_mutation();
CREATE TRIGGER audit_remediation_immutable BEFORE UPDATE OR DELETE ON public.audit_remediation_events
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_record_mutation();
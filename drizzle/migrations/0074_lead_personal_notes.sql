CREATE TABLE public.lead_personal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_label text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX lead_personal_notes_lead_idx ON public.lead_personal_notes (lead_id, created_at DESC) WHERE deleted_at IS NULL;
GRANT ALL ON public.lead_personal_notes TO service_role;
ALTER TABLE public.lead_personal_notes ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.lead_personal_notes IS 'Staff personal notes on a lead. Server-only access (scoped by resolveCaller); soft delete via deleted_at, never merged into call_reports.';
CREATE TRIGGER lead_personal_notes_touch BEFORE UPDATE ON public.lead_personal_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
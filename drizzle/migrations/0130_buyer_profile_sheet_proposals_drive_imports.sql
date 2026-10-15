ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS buyer_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.sheet_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_date date NOT NULL,
  lead_id uuid,
  kind text NOT NULL CHECK (kind IN ('stage','note','payment','new_lead')),
  proposed jsonb NOT NULL,
  current_value text,
  fingerprint text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected')),
  decided_by text,
  decided_at timestamptz,
  result_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sheet_change_proposals TO service_role;
ALTER TABLE public.sheet_change_proposals ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.drive_recording_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text,
  drive_link text,
  file_created_at timestamptz,
  lead_id uuid,
  call_recording_id uuid,
  agent_id uuid,
  match_method text,
  status text NOT NULL DEFAULT 'unmatched' CHECK (status IN ('matched','unmatched','linked','ignored')),
  linked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.drive_recording_imports (lead_id);
GRANT ALL ON public.drive_recording_imports TO service_role;
ALTER TABLE public.drive_recording_imports ENABLE ROW LEVEL SECURITY;
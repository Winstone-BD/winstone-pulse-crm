CREATE TABLE public.security_scan_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner text NOT NULL CHECK (length(scanner) BETWEEN 1 AND 80),
  scanned_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('complete','incomplete','failed')),
  notes text CHECK (length(notes) <= 2000),
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.security_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.security_scan_reports(id) ON DELETE CASCADE,
  finding_key text NOT NULL CHECK (length(finding_key) BETWEEN 1 AND 200),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  level text NOT NULL CHECK (level IN ('error','warn','info')),
  is_new boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fixed','ignored')),
  entered_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.security_findings(finding_key);
GRANT ALL ON public.security_scan_reports TO service_role;
GRANT ALL ON public.security_findings TO service_role;
ALTER TABLE public.security_scan_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;
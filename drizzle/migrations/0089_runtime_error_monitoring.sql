CREATE TABLE public.runtime_error_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'browser',
  kind text NOT NULL,
  message text NOT NULL,
  routes text[] NOT NULL DEFAULT '{}',
  occurrences integer NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  reopened_count integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.runtime_error_issues TO service_role;
ALTER TABLE public.runtime_error_issues ENABLE ROW LEVEL SECURITY;
CREATE INDEX runtime_error_issues_last_seen_idx ON public.runtime_error_issues (last_seen DESC);

CREATE TABLE public.runtime_error_occurrences (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES public.runtime_error_issues(id) ON DELETE CASCADE,
  route text NOT NULL,
  detail text,
  browser text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.runtime_error_occurrences TO service_role;
ALTER TABLE public.runtime_error_occurrences ENABLE ROW LEVEL SECURITY;
CREATE INDEX runtime_error_occ_issue_idx ON public.runtime_error_occurrences (issue_id, occurred_at DESC);
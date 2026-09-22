CREATE TABLE public.sheet_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface text NOT NULL,
  operation text NOT NULL DEFAULT 'read',
  outcome text NOT NULL,
  http_status integer,
  attempt integer NOT NULL DEFAULT 0,
  retry_wait_ms integer,
  duration_ms integer,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sheet_sync_events_created_idx ON public.sheet_sync_events (created_at DESC);
CREATE INDEX sheet_sync_events_surface_idx ON public.sheet_sync_events (surface, created_at DESC);

GRANT ALL ON public.sheet_sync_events TO service_role;

ALTER TABLE public.sheet_sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinators read sheet sync events"
ON public.sheet_sync_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_leader'));

GRANT SELECT ON public.sheet_sync_events TO authenticated;
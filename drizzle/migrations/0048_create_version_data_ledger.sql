CREATE TABLE public.version_data_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  app_version text,
  version_code integer,
  device_id uuid REFERENCES public.agent_devices(id) ON DELETE SET NULL,
  agent_id uuid,
  employee_id text,
  client_ref text,
  captured_offline boolean NOT NULL DEFAULT false,
  created_offline_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  restored_version_code integer,
  restored_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX version_data_ledger_agent_idx ON public.version_data_ledger (agent_id, version_code);
CREATE INDEX version_data_ledger_pending_idx ON public.version_data_ledger (agent_id, restored_at);
CREATE INDEX version_data_ledger_synced_idx ON public.version_data_ledger (synced_at DESC);

GRANT SELECT ON public.version_data_ledger TO authenticated;
GRANT ALL ON public.version_data_ledger TO service_role;

ALTER TABLE public.version_data_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coordinators read version ledger"
ON public.version_data_ledger
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_leader'));

COMMENT ON TABLE public.version_data_ledger IS 'Per-app-version record of every lead and call report synced from a phone, so data from a replaced version can be handed back to the new version.';
-- 1. Daily distribution run ledger: one row per Dhaka work date, used as the
-- idempotency lock plus a persistent allocation cursor.
CREATE TABLE IF NOT EXISTS public.lead_distribution_runs (
  work_date date PRIMARY KEY,
  status text NOT NULL DEFAULT 'running',
  trigger text NOT NULL DEFAULT 'manual',
  per_agent integer NOT NULL DEFAULT 0,
  moved integer NOT NULL DEFAULT 0,
  duplicates_skipped integer NOT NULL DEFAULT 0,
  cursor_created_at timestamptz,
  cursor_lead_id uuid,
  actor_label text,
  actor_profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_distribution_runs TO authenticated;
GRANT ALL ON public.lead_distribution_runs TO service_role;
ALTER TABLE public.lead_distribution_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read distribution runs"
ON public.lead_distribution_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_leader'));

CREATE TRIGGER lead_distribution_runs_touch
BEFORE UPDATE ON public.lead_distribution_runs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Push tokens for web browsers and Android devices.
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'web',
  token text NOT NULL UNIQUE,
  device_id uuid REFERENCES public.agent_devices(id) ON DELETE SET NULL,
  label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_profile_idx ON public.push_tokens(profile_id) WHERE revoked_at IS NULL;

GRANT SELECT ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push tokens readable"
ON public.push_tokens FOR SELECT TO authenticated
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE TRIGGER push_tokens_touch
BEFORE UPDATE ON public.push_tokens
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Push send ledger so one support event notifies each device exactly once.
CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  entity_id text,
  recipients integer NOT NULL DEFAULT 0,
  delivered integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  provider text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read push deliveries"
ON public.push_deliveries FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_leader'));
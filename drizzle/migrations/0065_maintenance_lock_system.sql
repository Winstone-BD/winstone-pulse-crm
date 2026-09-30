CREATE TYPE public.maintenance_payment_status AS ENUM ('unpaid','pending','verified');
CREATE TYPE public.maintenance_unlock_status AS ENUM ('none','requested','approved','denied','expired');

CREATE TABLE public.system_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period text NOT NULL UNIQUE,
  fee_usd numeric(10,2) NOT NULL DEFAULT 35.29,
  due_date timestamptz NOT NULL,
  lock_at timestamptz NOT NULL,
  payment_status public.maintenance_payment_status NOT NULL DEFAULT 'unpaid',
  payment_ref text,
  payment_verified_at timestamptz,
  payment_verified_by text,
  lock_status text NOT NULL DEFAULT 'active',
  unlock_status public.maintenance_unlock_status NOT NULL DEFAULT 'none',
  unlock_started_at timestamptz,
  unlock_expires_at timestamptz,
  approved_by text,
  approval_reason text,
  locked_logged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.system_maintenance TO service_role;
ALTER TABLE public.system_maintenance ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER system_maintenance_touch BEFORE UPDATE ON public.system_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.maintenance_unlock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period text NOT NULL,
  status public.maintenance_unlock_status NOT NULL DEFAULT 'requested',
  requested_by text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  requested_hours integer NOT NULL DEFAULT 4,
  reason text,
  payment_status_at_request public.maintenance_payment_status NOT NULL,
  payment_verified_at_request timestamptz,
  decided_at timestamptz,
  decided_by text,
  decision_reason text,
  duration_minutes integer,
  unlock_started_at timestamptz,
  unlock_expires_at timestamptz
);
CREATE UNIQUE INDEX maintenance_one_open_request ON public.maintenance_unlock_requests (billing_period) WHERE status = 'requested';
GRANT ALL ON public.maintenance_unlock_requests TO service_role;
ALTER TABLE public.maintenance_unlock_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.maintenance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  billing_period text,
  previous_state text,
  new_state text,
  reason text,
  request_id uuid,
  duration_minutes integer,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX maintenance_audit_at ON public.maintenance_audit (at DESC);
GRANT SELECT, INSERT ON public.maintenance_audit TO service_role;
ALTER TABLE public.maintenance_audit ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.block_maintenance_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Maintenance audit is append-only'; END $$;
CREATE TRIGGER maintenance_audit_immutable BEFORE UPDATE OR DELETE ON public.maintenance_audit
  FOR EACH ROW EXECUTE FUNCTION public.block_maintenance_audit_mutation();

CREATE TABLE public.architect_auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  email text,
  success boolean NOT NULL,
  stage text NOT NULL,
  ip text
);
CREATE INDEX architect_auth_attempts_at ON public.architect_auth_attempts (at DESC);
GRANT ALL ON public.architect_auth_attempts TO service_role;
ALTER TABLE public.architect_auth_attempts ENABLE ROW LEVEL SECURITY;
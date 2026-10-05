ALTER TABLE public.system_maintenance
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review','in_review'));
ALTER TABLE public.system_maintenance
  ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE public.system_maintenance
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE TABLE public.service_bill_review_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_email text,
  ip_hash text NOT NULL,
  success boolean NOT NULL,
  reason_code text NOT NULL CHECK (reason_code IN ('success','identity_denied','role_denied','configuration_missing','rate_limited','invalid_pin'))
);
GRANT ALL ON public.service_bill_review_attempts TO service_role;
ALTER TABLE public.service_bill_review_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX service_bill_review_attempts_rate_idx
  ON public.service_bill_review_attempts (ip_hash, actor_user_id, attempted_at DESC);
CREATE TRIGGER service_bill_review_attempts_immutable
  BEFORE UPDATE OR DELETE ON public.service_bill_review_attempts
  FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();

COMMENT ON TABLE public.service_bill_review_attempts IS 'Server-only immutable audit/rate-limit events for review-only service-bill detail unlocks; credentials are never stored.';
COMMENT ON COLUMN public.system_maintenance.review_status IS 'Human review state only; never represents payment approval or execution.';
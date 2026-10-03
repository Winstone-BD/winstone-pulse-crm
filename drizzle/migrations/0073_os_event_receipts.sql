CREATE TABLE public.os_event_receipts (
  idempotency_key text PRIMARY KEY,
  event_id text NOT NULL,
  event_type text NOT NULL,
  api_version text,
  payload_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  outcome text,
  lead_id uuid,
  booking_id uuid,
  attempts integer NOT NULL DEFAULT 1,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT ALL ON public.os_event_receipts TO service_role;
REVOKE ALL ON public.os_event_receipts FROM anon, authenticated;
ALTER TABLE public.os_event_receipts ENABLE ROW LEVEL SECURITY;
CREATE INDEX os_event_receipts_received_idx ON public.os_event_receipts (received_at DESC);
COMMENT ON TABLE public.os_event_receipts IS 'Server-only inbound Winstone OS event receipts; no client policies by design.';
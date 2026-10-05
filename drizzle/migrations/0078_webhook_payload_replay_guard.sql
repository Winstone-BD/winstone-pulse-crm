ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS payload_sha256 text;

CREATE INDEX IF NOT EXISTS webhook_deliveries_payload_sha256_idx
  ON public.webhook_deliveries (payload_sha256)
  WHERE payload_sha256 IS NOT NULL;

COMMENT ON COLUMN public.webhook_deliveries.payload_sha256 IS
  'Server-computed SHA-256 used to reject event-id reuse with a different payload.';
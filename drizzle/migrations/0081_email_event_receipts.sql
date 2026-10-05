CREATE TABLE public.email_event_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'hostinger',
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  mailbox text,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  received_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.email_event_receipts FROM anon, authenticated;
GRANT ALL ON public.email_event_receipts TO service_role;
ALTER TABLE public.email_event_receipts ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.email_event_receipts IS 'Server-only Hostinger webhook receipts: metadata + hash only, never message content.';
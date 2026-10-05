ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_webhook_event_id text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_webhook_occurred_at timestamptz;
CREATE INDEX IF NOT EXISTS subscriptions_last_webhook_occurred_idx ON public.subscriptions (last_webhook_occurred_at DESC);
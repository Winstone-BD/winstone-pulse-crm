CREATE TABLE public.bulk_extra_batches (
  work_date date PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  quantity integer NOT NULL,
  status text NOT NULL DEFAULT 'running',
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT ALL ON public.bulk_extra_batches TO service_role;
ALTER TABLE public.bulk_extra_batches ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.bulk_extra_batches IS 'Server-only lock: at most one IT Console bulk extra-lead batch per Dhaka day.';
CREATE TABLE public.payment_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL DEFAULT 'crm',
  billing_period TEXT NOT NULL,
  payment_ref TEXT NOT NULL,
  base_cents INTEGER NOT NULL,
  vat_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  verified_by TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_code, billing_period)
);
GRANT ALL ON public.payment_vouchers TO service_role;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
-- Server-only table: no anon/authenticated policies. Reads go through the IT Console server function.
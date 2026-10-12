REVOKE ALL ON public.payment_vouchers FROM anon, authenticated;
GRANT ALL ON public.payment_vouchers TO service_role;
COMMENT ON TABLE public.payment_vouchers IS 'Server-only: read via IT Console (PIN) or architect session; no browser access.';
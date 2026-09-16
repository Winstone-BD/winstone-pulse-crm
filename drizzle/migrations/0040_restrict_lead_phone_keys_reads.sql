-- Phone identity keys are an internal de-duplication index, only used by
-- service-role server logic. No client ever reads them, so close the
-- open read policy that exposed every lead's canonical phone number.
DROP POLICY IF EXISTS "Authenticated users can read lead phone keys" ON public.lead_phone_keys;
REVOKE SELECT ON public.lead_phone_keys FROM authenticated;
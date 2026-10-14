REVOKE EXECUTE ON FUNCTION public.write_record_audit() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.protect_social_activity() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.protect_social_activity() FROM PUBLIC, anon, authenticated;
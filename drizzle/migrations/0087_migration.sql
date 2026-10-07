REVOKE EXECUTE ON FUNCTION public.lead_is_recalled_untouched(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_is_recalled_untouched(uuid) TO authenticated, service_role;
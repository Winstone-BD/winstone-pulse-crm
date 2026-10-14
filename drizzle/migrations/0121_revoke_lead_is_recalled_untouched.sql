REVOKE EXECUTE ON FUNCTION public.lead_is_recalled_untouched(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_is_recalled_untouched(uuid) TO service_role;
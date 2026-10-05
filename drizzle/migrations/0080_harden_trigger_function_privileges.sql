ALTER FUNCTION public.block_accountability_delete() SET search_path = public;
ALTER FUNCTION public.validate_service_invoice() SET search_path = public;

REVOKE ALL ON FUNCTION public.log_call_recording_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_call_report_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_contact_close() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_follow_up_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_lead_state_change() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_call_recording_created() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_call_report_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_contact_close() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_follow_up_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_lead_state_change() TO service_role;
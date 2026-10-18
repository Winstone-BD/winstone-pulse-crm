CREATE OR REPLACE FUNCTION public.begin_pin_auth_attempt(_subject text, _surface text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pin_auth_attempt_state; n timestamptz := clock_timestamp(); lease uuid := gen_random_uuid();
BEGIN
 IF _subject IS NULL OR _subject !~ '^[a-f0-9]{64}$' OR _surface IS NULL OR _surface NOT IN ('hq','system','leadhub') THEN RAISE EXCEPTION 'Invalid authentication scope'; END IF;
 INSERT INTO public.pin_auth_attempt_state(subject_hash,surface) VALUES(_subject,_surface) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM public.pin_auth_attempt_state WHERE subject_hash=_subject AND surface=_surface FOR UPDATE;
 IF r.blocked_until > n THEN RETURN jsonb_build_object('allowed',false,'retryAfterSeconds',ceil(extract(epoch FROM r.blocked_until-n))::integer); END IF;
 IF r.lease_until > n THEN RETURN jsonb_build_object('allowed',false,'retryAfterSeconds',ceil(extract(epoch FROM r.lease_until-n))::integer); END IF;
 IF r.blocked_until IS NOT NULL THEN r.failures := 0; END IF;
 UPDATE public.pin_auth_attempt_state SET failures=r.failures, blocked_until=NULL, lease_id=lease,lease_until=n+interval '30 seconds' WHERE subject_hash=_subject AND surface=_surface;
 RETURN jsonb_build_object('allowed',true,'lease',lease,'retryAfterSeconds',0);
END $$;
CREATE OR REPLACE FUNCTION public.finish_pin_auth_attempt(_subject text, _surface text, _lease uuid, _success boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pin_auth_attempt_state; n timestamptz := clock_timestamp(); failures_after integer; blocked_after timestamptz;
BEGIN
 SELECT * INTO r FROM public.pin_auth_attempt_state WHERE subject_hash=_subject AND surface=_surface FOR UPDATE;
 IF NOT FOUND OR _success IS NULL OR r.lease_id IS DISTINCT FROM _lease OR r.lease_until IS NULL OR r.lease_until <= n THEN RETURN jsonb_build_object('accepted',false,'retryAfterSeconds',30); END IF;
 failures_after := CASE WHEN _success THEN 0 ELSE least(r.failures+1,5) END;
 blocked_after := CASE WHEN failures_after>=5 THEN n+interval '5 minutes' ELSE NULL END;
 UPDATE public.pin_auth_attempt_state SET failures=failures_after, blocked_until=blocked_after,lease_id=NULL,lease_until=NULL WHERE subject_hash=_subject AND surface=_surface;
 RETURN jsonb_build_object('accepted',true,'retryAfterSeconds',CASE WHEN blocked_after IS NULL THEN 0 ELSE ceil(extract(epoch FROM blocked_after-n))::integer END);
END $$;
REVOKE ALL ON FUNCTION public.begin_pin_auth_attempt(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_pin_auth_attempt(text,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_pin_auth_attempt(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_pin_auth_attempt(text,text,uuid,boolean) TO service_role;
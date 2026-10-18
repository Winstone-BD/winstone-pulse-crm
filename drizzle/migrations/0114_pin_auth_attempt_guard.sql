CREATE TABLE public.pin_auth_attempt_state (
 subject_hash text NOT NULL,
 surface text NOT NULL CHECK (surface IN ('hq','system','leadhub')),
 failures integer NOT NULL DEFAULT 0 CHECK (failures BETWEEN 0 AND 5),
 blocked_until timestamptz,
 lease_id uuid,
 lease_until timestamptz,
 PRIMARY KEY(subject_hash, surface)
);
GRANT ALL ON public.pin_auth_attempt_state TO service_role;
ALTER TABLE public.pin_auth_attempt_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY pin_auth_service_only ON public.pin_auth_attempt_state TO service_role USING (true) WITH CHECK (true);
CREATE FUNCTION public.begin_pin_auth_attempt(_subject text, _surface text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pin_auth_attempt_state; n timestamptz := clock_timestamp(); lease uuid := gen_random_uuid();
BEGIN
 IF _subject !~ '^[a-f0-9]{64}$' OR _surface NOT IN ('hq','system','leadhub') THEN RAISE EXCEPTION 'Invalid authentication scope'; END IF;
 INSERT INTO public.pin_auth_attempt_state(subject_hash,surface) VALUES(_subject,_surface) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM public.pin_auth_attempt_state WHERE subject_hash=_subject AND surface=_surface FOR UPDATE;
 IF r.blocked_until > n THEN RETURN jsonb_build_object('allowed',false,'retryAfterSeconds',ceil(extract(epoch FROM r.blocked_until-n))::integer); END IF;
 IF r.lease_until > n THEN RETURN jsonb_build_object('allowed',false,'retryAfterSeconds',ceil(extract(epoch FROM r.lease_until-n))::integer); END IF;
 IF r.blocked_until IS NOT NULL THEN r.failures := 0; END IF;
 UPDATE public.pin_auth_attempt_state SET failures=least(r.failures+1,5), blocked_until=CASE WHEN r.failures+1>=5 THEN n+interval '5 minutes' ELSE NULL END,lease_id=lease,lease_until=n+interval '30 seconds' WHERE subject_hash=_subject AND surface=_surface;
 RETURN jsonb_build_object('allowed',true,'lease',lease,'retryAfterSeconds',0);
END $$;
CREATE FUNCTION public.finish_pin_auth_attempt(_subject text, _surface text, _lease uuid, _success boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pin_auth_attempt_state; n timestamptz := clock_timestamp();
BEGIN
 SELECT * INTO r FROM public.pin_auth_attempt_state WHERE subject_hash=_subject AND surface=_surface FOR UPDATE;
 IF NOT FOUND OR r.lease_id IS DISTINCT FROM _lease OR r.lease_until < n THEN RETURN jsonb_build_object('accepted',false,'retryAfterSeconds',30); END IF;
 UPDATE public.pin_auth_attempt_state SET failures=CASE WHEN _success THEN 0 ELSE failures END,blocked_until=CASE WHEN _success THEN NULL ELSE blocked_until END,lease_id=NULL,lease_until=NULL WHERE subject_hash=_subject AND surface=_surface;
 RETURN jsonb_build_object('accepted',true,'retryAfterSeconds',CASE WHEN _success OR r.blocked_until IS NULL THEN 0 ELSE greatest(0,ceil(extract(epoch FROM r.blocked_until-n))::integer) END);
END $$;
REVOKE ALL ON FUNCTION public.begin_pin_auth_attempt(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_pin_auth_attempt(text,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_pin_auth_attempt(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_pin_auth_attempt(text,text,uuid,boolean) TO service_role;
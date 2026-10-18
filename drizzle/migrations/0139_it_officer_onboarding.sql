CREATE TABLE public.it_officer_onboarding (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE,
 name text NOT NULL,
 user_id uuid UNIQUE,
 profile_id uuid REFERENCES public.profiles(id),
 invited_by uuid NOT NULL,
 invited_at timestamptz NOT NULL DEFAULT now(),
 password_set_at timestamptz,
 approved_at timestamptz,
 approved_by uuid,
 role_assigned_at timestamptz,
 role_assigned_by uuid,
 status text NOT NULL DEFAULT 'inviting' CHECK (status IN ('inviting','invited','password_set','approved','active','failed'))
);
GRANT ALL ON public.it_officer_onboarding TO service_role;
ALTER TABLE public.it_officer_onboarding ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.advance_it_officer_onboarding(_id uuid, _action text, _actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.it_officer_onboarding%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.it_officer_onboarding WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
 IF _action='password_set' THEN
  IF r.user_id IS DISTINCT FROM _actor OR r.status NOT IN ('invited','password_set') THEN RAISE EXCEPTION 'Password setup is unavailable'; END IF;
  UPDATE public.it_officer_onboarding SET password_set_at=now(),status='password_set' WHERE id=_id;
 ELSIF _action='approve' THEN
  IF r.status<>'password_set' OR r.password_set_at IS NULL THEN RAISE EXCEPTION 'Password setup required'; END IF;
  UPDATE public.it_officer_onboarding SET approved_at=now(),approved_by=_actor,status='approved' WHERE id=_id;
 ELSIF _action='assign_role' THEN
  IF r.status<>'approved' OR r.approved_at IS NULL OR r.password_set_at IS NULL THEN RAISE EXCEPTION 'Approval required'; END IF;
  IF r.user_id IS NULL OR r.profile_id IS NULL THEN RAISE EXCEPTION 'Account link missing'; END IF;
  UPDATE public.profiles SET approval_status='approved',is_active=true,role='admin' WHERE id=r.profile_id AND user_id=r.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account link changed'; END IF;
  INSERT INTO public.user_roles(user_id,role) VALUES(r.user_id,'admin') ON CONFLICT(user_id,role) DO NOTHING;
  UPDATE public.it_officer_onboarding SET role_assigned_at=now(),role_assigned_by=_actor,status='active' WHERE id=_id;
 ELSE RAISE EXCEPTION 'Invalid onboarding action'; END IF;
 INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_label,metadata) VALUES('it_officer_'||_action,'profile',r.profile_id::text,'IT onboarding',jsonb_build_object('actorUserId',_actor,'onboardingId',_id));
END; $$;
REVOKE ALL ON FUNCTION public.advance_it_officer_onboarding(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_it_officer_onboarding(uuid,text,uuid) TO service_role;
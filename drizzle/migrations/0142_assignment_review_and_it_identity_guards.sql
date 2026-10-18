CREATE OR REPLACE FUNCTION public.guard_assignment_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid:=coalesce(NEW.assigned_to,NEW.assigned_agent_id); d date:=(now() AT TIME ZONE 'Asia/Dhaka')::date;
BEGIN
 IF target IS NOT NULL AND (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id) THEN
  IF extract(isodow FROM d)=5 THEN RAISE EXCEPTION 'Friday distribution is disabled'; END IF;
  IF EXISTS(SELECT 1 FROM public.agent_accountability_reviews WHERE agent_id=target AND status<>'approved' AND unlock_for_date<=d) THEN RAISE EXCEPTION 'HQ review required before allocation'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER leads_assignment_review_guard BEFORE UPDATE OF assigned_to,assigned_agent_id ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_review();
CREATE OR REPLACE FUNCTION public.guard_it_onboarding_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid;
BEGIN
 IF NEW.status IN ('password_set','approved','active') AND NEW.status IS DISTINCT FROM OLD.status THEN
  IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.user_id=u.id WHERE u.id=NEW.user_id AND p.id=NEW.profile_id AND lower(u.email)=NEW.email AND lower(p.email)=NEW.email AND u.email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Verified invited identity required'; END IF;
  IF EXISTS(SELECT 1 FROM public.privileged_account_allowlist WHERE lower(email)=NEW.email) THEN RAISE EXCEPTION 'Protected identities cannot use officer onboarding'; END IF;
  IF NEW.status='password_set' AND OLD.status<>'invited' THEN RAISE EXCEPTION 'Password transition already completed'; END IF;
  IF NEW.status='approved' AND OLD.status<>'password_set' THEN RAISE EXCEPTION 'Password setup required'; END IF;
  IF NEW.status='active' AND OLD.status<>'approved' THEN RAISE EXCEPTION 'Approval required'; END IF;
  actor:=CASE WHEN NEW.status='approved' THEN NEW.approved_by WHEN NEW.status='active' THEN NEW.role_assigned_by END;
  IF actor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.user_id WHERE p.user_id=actor AND p.is_active AND p.approval_status='approved' AND r.role='admin') THEN RAISE EXCEPTION 'Approved manager required'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER it_onboarding_transition_guard BEFORE UPDATE ON public.it_officer_onboarding FOR EACH ROW EXECUTE FUNCTION public.guard_it_onboarding_transition();
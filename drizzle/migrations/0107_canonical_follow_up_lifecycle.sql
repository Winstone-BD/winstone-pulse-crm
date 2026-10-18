ALTER TABLE public.follow_up_events ADD COLUMN IF NOT EXISTS parent_follow_up_id uuid REFERENCES public.follow_up_events(id), ADD COLUMN IF NOT EXISTS correlation_id uuid NOT NULL DEFAULT gen_random_uuid(), ADD COLUMN IF NOT EXISTS idempotency_key text, ADD COLUMN IF NOT EXISTS outcome text, ADD COLUMN IF NOT EXISTS transition_reason text, ADD COLUMN IF NOT EXISTS transition_actor uuid, ADD COLUMN IF NOT EXISTS transition_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS follow_up_creation_key_uq ON public.follow_up_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS follow_up_parent_uq ON public.follow_up_events(parent_follow_up_id) WHERE parent_follow_up_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_follow_up_lifecycle() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.agent_id IS NULL THEN RAISE EXCEPTION 'Follow-up agent required'; END IF;
  IF NEW.scheduled_at<=now() THEN RAISE EXCEPTION 'Choose a future follow-up time'; END IF;
  NEW.next_action:=coalesce(nullif(trim(NEW.next_action),''),nullif(trim(NEW.note),''),NEW.category);
  NEW.idempotency_key:=coalesce(NEW.idempotency_key,NEW.correlation_id::text);
 ELSE
  IF NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.agent_id IS DISTINCT FROM OLD.agent_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR NEW.report_id IS DISTINCT FROM OLD.report_id OR NEW.note IS DISTINCT FROM OLD.note OR NEW.reason_code IS DISTINCT FROM OLD.reason_code OR NEW.next_action IS DISTINCT FROM OLD.next_action OR NEW.parent_follow_up_id IS DISTINCT FROM OLD.parent_follow_up_id OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN RAISE EXCEPTION 'Preserve original follow-up; create a linked replacement'; END IF;
  IF OLD.status IN ('done','completed','cancelled','canceled','rescheduled') AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.transition_reason IS DISTINCT FROM OLD.transition_reason) THEN RAISE EXCEPTION 'Resolved follow-up history is immutable'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('done','completed','cancelled','rescheduled','missed') THEN
   IF length(trim(coalesce(NEW.transition_reason,'')))=0 THEN RAISE EXCEPTION 'Follow-up reason / outcome required'; END IF;
   IF NEW.status IN ('done','completed') AND length(trim(coalesce(NEW.outcome,'')))=0 THEN RAISE EXCEPTION 'Completion outcome required'; END IF;
   IF NEW.status='missed' AND NEW.scheduled_at>now() THEN RAISE EXCEPTION 'Future follow-up cannot be missed'; END IF;
  END IF;
 END IF;
 IF NEW.status NOT IN ('upcoming','due','done','completed','rescheduled','cancelled','canceled','missed') THEN RAISE EXCEPTION 'Invalid follow-up status'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER follow_up_lifecycle_guard BEFORE INSERT OR UPDATE ON public.follow_up_events FOR EACH ROW EXECUTE FUNCTION public.guard_follow_up_lifecycle();

CREATE OR REPLACE FUNCTION public.log_follow_up_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a text;
BEGIN
 IF TG_OP='INSERT' THEN a:='created';
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN a:=CASE WHEN NEW.status IN ('done','completed') THEN 'completed' WHEN NEW.status IN ('cancelled','canceled') THEN 'cancelled' WHEN NEW.status='rescheduled' THEN 'rescheduled' WHEN NEW.status='missed' THEN 'missed' ELSE 'status_changed' END;
 ELSE RETURN NEW; END IF;
 INSERT INTO public.follow_up_changes(follow_up_id,lead_id,action,old_scheduled_at,new_scheduled_at,old_status,new_status,old_reason_code,reason_code,old_note,note,changed_by,correlation_id)
 VALUES(NEW.id,NEW.lead_id,a,CASE WHEN TG_OP='UPDATE' THEN OLD.scheduled_at END,NEW.scheduled_at,CASE WHEN TG_OP='UPDATE' THEN OLD.status END,NEW.status,CASE WHEN TG_OP='UPDATE' THEN OLD.reason_code END,NEW.reason_code,CASE WHEN TG_OP='UPDATE' THEN coalesce(OLD.transition_reason,OLD.note) END,coalesce(NEW.transition_reason,NEW.note),coalesce(NEW.transition_actor,auth.uid(),NEW.agent_id),coalesce(NEW.transition_key,gen_random_uuid()));
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.transition_follow_up_atomic(_event uuid,_actor uuid,_action text,_reason text,_scheduled_at timestamptz,_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.follow_up_events%ROWTYPE; child uuid;
BEGIN
 IF _action NOT IN ('complete','reschedule','cancel','miss') OR length(trim(coalesce(_reason,'')))=0 OR _key IS NULL THEN RAISE EXCEPTION 'Valid action, reason and idempotency key required'; END IF;
 SELECT * INTO f FROM public.follow_up_events WHERE id=_event FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Follow-up not found'; END IF;
 IF f.transition_key=_key THEN
  SELECT id INTO child FROM public.follow_up_events WHERE parent_follow_up_id=f.id;
  RETURN jsonb_build_object('ok',true,'alreadyApplied',true,'followUpId',coalesce(child,f.id));
 END IF;
 IF f.status NOT IN ('upcoming','due','missed') THEN RAISE EXCEPTION 'Follow-up already resolved'; END IF;
 IF _action='miss' AND (f.scheduled_at>now() OR f.status='missed') THEN RAISE EXCEPTION 'Follow-up is not newly missed'; END IF;
 IF _action='reschedule' THEN
  IF _scheduled_at IS NULL OR _scheduled_at<=now() THEN RAISE EXCEPTION 'Choose a future follow-up time'; END IF;
  UPDATE public.follow_up_events SET status='rescheduled',transition_reason=trim(_reason),transition_actor=_actor,transition_key=_key WHERE id=f.id;
  INSERT INTO public.follow_up_events(lead_id,agent_id,report_id,recording_id,customer_name,phone_number,category,priority,note,reason_code,customer_response,next_action,previous_call_id,scheduled_at,reminder_minutes,parent_follow_up_id,idempotency_key)
  VALUES(f.lead_id,f.agent_id,f.report_id,f.recording_id,f.customer_name,f.phone_number,f.category,f.priority,f.note,f.reason_code,f.customer_response,f.next_action,f.previous_call_id,_scheduled_at,f.reminder_minutes,f.id,'reschedule:'||_key::text) RETURNING id INTO child;
 ELSE
  UPDATE public.follow_up_events SET status=CASE _action WHEN 'complete' THEN 'done' WHEN 'cancel' THEN 'cancelled' ELSE 'missed' END,completed_at=CASE WHEN _action='complete' THEN now() ELSE NULL END,outcome=CASE WHEN _action='complete' THEN trim(_reason) ELSE outcome END,transition_reason=trim(_reason),transition_actor=_actor,transition_key=_key WHERE id=f.id;
 END IF;
 INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_profile_id,metadata) VALUES('follow_up_'||_action,'follow_up_event',f.id::text,_actor,jsonb_build_object('reason',trim(_reason),'replacementId',child,'correlationId',_key));
 RETURN jsonb_build_object('ok',true,'alreadyApplied',false,'followUpId',coalesce(child,f.id));
END $$;
REVOKE ALL ON FUNCTION public.transition_follow_up_atomic(uuid,uuid,text,text,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_follow_up_atomic(uuid,uuid,text,text,timestamptz,uuid) TO service_role;

DROP POLICY IF EXISTS "Read own follow-ups or supervisors read all" ON public.follow_up_events;
CREATE POLICY "Read own follow-ups or supervisors read all" ON public.follow_up_events FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_leader') OR EXISTS(SELECT 1 FROM public.profiles p JOIN public.leads l ON l.id=follow_up_events.lead_id WHERE p.user_id=auth.uid() AND p.id=follow_up_events.agent_id AND coalesce(l.assigned_to,l.assigned_agent_id)=p.id));
DROP POLICY IF EXISTS "Agents update own follow-ups" ON public.follow_up_events;
CREATE POLICY "Agents update own follow-ups" ON public.follow_up_events FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.profiles p JOIN public.leads l ON l.id=follow_up_events.lead_id WHERE p.user_id=auth.uid() AND p.id=follow_up_events.agent_id AND coalesce(l.assigned_to,l.assigned_agent_id)=p.id)) WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p JOIN public.leads l ON l.id=follow_up_events.lead_id WHERE p.user_id=auth.uid() AND p.id=follow_up_events.agent_id AND coalesce(l.assigned_to,l.assigned_agent_id)=p.id));

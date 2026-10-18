CREATE OR REPLACE FUNCTION public.recover_follow_up_atomic(_event uuid, _actor uuid, _scheduled_at timestamptz, _reason text, _next_action text, _key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.follow_up_events%ROWTYPE; child uuid; existing_key text; owner_id uuid;
BEGIN
 IF _actor IS NULL OR _key IS NULL OR length(trim(coalesce(_reason,'')))=0 OR length(trim(coalesce(_next_action,'')))=0 THEN RAISE EXCEPTION 'Actor, reason, next action and key required'; END IF;
 SELECT * INTO f FROM public.follow_up_events WHERE id=_event FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Follow-up not found'; END IF;
 SELECT coalesce(assigned_to,assigned_agent_id) INTO owner_id FROM public.leads WHERE id=f.lead_id FOR SHARE;
 IF owner_id IS DISTINCT FROM _actor OR f.agent_id IS DISTINCT FROM _actor THEN RAISE EXCEPTION 'Follow-up not assigned to you'; END IF;
 SELECT id,idempotency_key INTO child,existing_key FROM public.follow_up_events WHERE parent_follow_up_id=f.id;
 IF child IS NOT NULL THEN
  IF existing_key='recovery:'||_key::text THEN RETURN jsonb_build_object('ok',true,'alreadyApplied',true,'followUpId',child); END IF;
  RAISE EXCEPTION 'Recovery or replacement already exists';
 END IF;
 IF f.status NOT IN ('upcoming','due','missed') OR f.scheduled_at>now() THEN RAISE EXCEPTION 'Only missed or overdue follow-ups can be recovered'; END IF;
 IF _scheduled_at IS NULL OR _scheduled_at<=now() THEN RAISE EXCEPTION 'Choose a future follow-up time'; END IF;
 INSERT INTO public.follow_up_events(lead_id,agent_id,report_id,recording_id,customer_name,phone_number,category,priority,note,reason_code,customer_response,next_action,previous_call_id,scheduled_at,reminder_minutes,parent_follow_up_id,idempotency_key,transition_actor)
 VALUES(f.lead_id,_actor,f.report_id,f.recording_id,f.customer_name,f.phone_number,f.category,f.priority,trim(_reason),f.reason_code,f.customer_response,trim(_next_action),f.previous_call_id,_scheduled_at,f.reminder_minutes,f.id,'recovery:'||_key::text,_actor) RETURNING id INTO child;
 INSERT INTO public.follow_up_changes(follow_up_id,lead_id,action,old_scheduled_at,new_scheduled_at,old_status,new_status,old_reason_code,reason_code,old_note,note,changed_by,correlation_id)
 VALUES(f.id,f.lead_id,'recovered',f.scheduled_at,_scheduled_at,f.status,f.status,f.reason_code,f.reason_code,coalesce(f.transition_reason,f.note),trim(_reason),_actor,_key);
 INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_profile_id,metadata) VALUES('follow_up_recover','follow_up_event',f.id::text,_actor,jsonb_build_object('reason',trim(_reason),'nextAction',trim(_next_action),'replacementId',child,'correlationId',_key));
 RETURN jsonb_build_object('ok',true,'alreadyApplied',false,'followUpId',child);
END $$;
REVOKE ALL ON FUNCTION public.recover_follow_up_atomic(uuid,uuid,timestamptz,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_follow_up_atomic(uuid,uuid,timestamptz,text,text,uuid) TO service_role;
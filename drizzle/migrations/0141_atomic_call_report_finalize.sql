CREATE OR REPLACE FUNCTION public.finalize_call_report_atomic(_report uuid,_agent uuid,_report_patch jsonb,_lead_patch jsonb,_followup jsonb,_classification jsonb,_evaluation_detail text,_outcome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.call_reports%ROWTYPE; p public.call_reports%ROWTYPE; l public.leads%ROWTYPE; f public.follow_up_events%ROWTYPE; existing_id uuid; follow_id uuid; v public.leads%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.call_reports WHERE id=_report FOR UPDATE;
 IF NOT FOUND OR r.agent_id IS DISTINCT FROM _agent THEN RAISE EXCEPTION 'Report does not belong to agent'; END IF;
 IF r.status='submitted' THEN RETURN jsonb_build_object('alreadySubmitted',true); END IF;
 SELECT * INTO v FROM public.leads WHERE id=r.lead_id FOR UPDATE;
 IF v.assigned_to IS DISTINCT FROM _agent AND v.assigned_agent_id IS DISTINCT FROM _agent THEN RAISE EXCEPTION 'Lead owner changed'; END IF;
 p:=jsonb_populate_record(r,_report_patch);
 IF p.status<>'submitted' THEN RAISE EXCEPTION 'Submitted state required'; END IF;
 l:=jsonb_populate_record(v,_lead_patch);
 IF _followup IS NOT NULL THEN
  f:=jsonb_populate_record(NULL::public.follow_up_events,_followup);
  IF f.scheduled_at IS NULL THEN RAISE EXCEPTION 'Follow-up time required'; END IF;
  SELECT id INTO existing_id FROM public.follow_up_events WHERE lead_id=r.lead_id AND agent_id=_agent AND status='upcoming' ORDER BY scheduled_at,id LIMIT 1 FOR UPDATE;
  IF existing_id IS NOT NULL THEN
   UPDATE public.follow_up_events SET scheduled_at=f.scheduled_at,category=f.category,priority=f.priority,reason_code=f.reason_code,note=f.note,customer_response=f.customer_response,next_action=f.next_action,previous_call_id=r.recording_id,reminder_minutes=coalesce(f.reminder_minutes,30),notified_at=NULL,status='upcoming' WHERE id=existing_id;
   follow_id:=existing_id;
  ELSE
   INSERT INTO public.follow_up_events(lead_id,agent_id,report_id,recording_id,customer_name,phone_number,category,priority,reason_code,note,customer_response,next_action,previous_call_id,scheduled_at,reminder_minutes,status)
   VALUES(r.lead_id,_agent,r.id,r.recording_id,v.name,v.phone_number,f.category,f.priority,f.reason_code,f.note,f.customer_response,f.next_action,r.recording_id,f.scheduled_at,coalesce(f.reminder_minutes,30),'upcoming') RETURNING id INTO follow_id;
  END IF;
 ELSE
  UPDATE public.follow_up_events SET status='done',completed_at=now() WHERE lead_id=r.lead_id AND agent_id=_agent AND status='upcoming';
 END IF;
 UPDATE public.leads SET status=l.status,outcome_category=l.outcome_category,notes=l.notes,last_call_at=l.last_call_at,temperature=l.temperature,grade=l.grade,classification_note=l.classification_note,classified_at=l.classified_at,classified_by=l.classified_by,work_state=l.work_state,unanswered_attempts=l.unanswered_attempts,retry_after=l.retry_after WHERE id=r.lead_id;
 IF _classification IS NOT NULL THEN
  INSERT INTO public.lead_classifications(lead_id,agent_id,report_id,temperature,grade,note,source,classified_at)
  VALUES(r.lead_id,_agent,r.id,p.temperature,p.grade,p.note,'manual',now());
 END IF;
 IF _evaluation_detail IS NOT NULL THEN INSERT INTO public.lead_events(lead_id,agent_id,recording_id,kind,detail) VALUES(r.lead_id,_agent,r.recording_id,'evaluation_recorded',_evaluation_detail); END IF;
 INSERT INTO public.lead_events(lead_id,agent_id,recording_id,kind,detail) VALUES(r.lead_id,_agent,r.recording_id,'outcome_logged',_outcome);
 UPDATE public.call_reports SET status=p.status,category=p.category,summary=p.summary,note=p.note,reason=p.reason,follow_up_at=p.follow_up_at,connected=p.connected,duration_seconds=p.duration_seconds,connection_verified=p.connection_verified,temperature=p.temperature,grade=p.grade,ai_decision=p.ai_decision,interest=p.interest,requirement=p.requirement,customer_response=p.customer_response,next_action=p.next_action,no_follow_up_reason=p.no_follow_up_reason,no_follow_up_note=p.no_follow_up_note,smart_reasons=p.smart_reasons,evaluation_answers=p.evaluation_answers,evaluation_score=p.evaluation_score,evaluation_model=p.evaluation_model,follow_up_priority=p.follow_up_priority,next_best_action=p.next_best_action,submitted_at=now() WHERE id=r.id;
 INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_profile_id,metadata) VALUES('call_report_submitted','call_report',r.id::text,_agent,jsonb_build_object('leadId',r.lead_id,'followUpId',follow_id));
 RETURN jsonb_build_object('alreadySubmitted',false,'followUpId',follow_id);
END $$;
REVOKE ALL ON FUNCTION public.finalize_call_report_atomic(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_call_report_atomic(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text) TO service_role;
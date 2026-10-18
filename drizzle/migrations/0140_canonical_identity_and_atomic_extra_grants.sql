CREATE OR REPLACE FUNCTION public.claim_lead_phone_keys()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p text; owner_id uuid; found_phone boolean:=false;
BEGIN
 FOR p IN SELECT * FROM public.extract_bd_phones(NEW.phone_number) ORDER BY 1 LOOP
  found_phone:=true;
  INSERT INTO public.lead_phone_keys(canonical_phone,lead_id) VALUES(p,NEW.id)
   ON CONFLICT(canonical_phone) DO UPDATE SET lead_id=lead_phone_keys.lead_id RETURNING lead_id INTO owner_id;
  IF owner_id IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='normalized lead phone already exists'; END IF;
 END LOOP;
 IF NOT found_phone THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='no valid phone identity found'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.lead_is_recalled_untouched(_lead_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.lead_neglect_recalls WHERE lead_id=_lead_id)
 AND EXISTS(SELECT 1 FROM public.leads WHERE id=_lead_id AND coalesce(call_count,0)=0 AND coalesce(call_attempts,0)=0 AND last_call_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.call_reports WHERE lead_id=_lead_id)
 AND NOT EXISTS(SELECT 1 FROM public.call_recordings WHERE lead_id=_lead_id)
 AND NOT EXISTS(SELECT 1 FROM public.lead_events WHERE lead_id=_lead_id AND kind NOT IN ('workday_moved','neglect_warning','neglect_recalled','hq_review_comment'));
$$;
CREATE OR REPLACE FUNCTION public.allocate_extra_leads_atomic(_agent uuid,_ids uuid[],_quantity integer,_request uuid,_reason text,_source text,_actor uuid,_label text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d date:=(now() AT TIME ZONE 'Asia/Dhaka')::date; prior public.lead_extra_grants%ROWTYPE; moved_ids uuid[]; n integer; aid uuid;
BEGIN
 IF extract(isodow FROM d)=5 THEN RAISE EXCEPTION 'Friday distribution is disabled'; END IF;
 IF _quantity<1 OR _quantity>200 OR cardinality(_ids)>_quantity OR _source NOT IN ('manual_extra','auto_refill') THEN RAISE EXCEPTION 'Invalid allocation request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('extra:'||_agent::text,0));
 IF _request IS NOT NULL THEN
  SELECT * INTO prior FROM public.lead_extra_grants WHERE request_id=_request AND agent_profile_id=_agent;
  IF FOUND THEN RETURN jsonb_build_object('moved',prior.quantity,'replayed',true,'workDate',prior.work_date); END IF;
 END IF;
 PERFORM 1 FROM public.profiles WHERE id=_agent AND is_active AND approval_status='approved' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agent not active'; END IF;
 IF EXISTS(SELECT 1 FROM public.agent_accountability_reviews WHERE agent_id=_agent AND status<>'approved' AND unlock_for_date<=d) THEN RAISE EXCEPTION 'HQ review required before allocation'; END IF;
 WITH changed AS (
  UPDATE public.leads SET assigned_to=_agent,assigned_agent_id=_agent,assignment_source='extra_manual',work_date=d
  WHERE id=ANY(_ids) AND assigned_to IS NULL AND assigned_agent_id IS NULL RETURNING id
 ) SELECT array_agg(id) INTO moved_ids FROM changed;
 n:=coalesce(cardinality(moved_ids),0);
 IF n=0 THEN RAISE EXCEPTION 'No new leads available; refresh preview'; END IF;
 INSERT INTO public.lead_assignments(lead_id,from_agent_id,to_agent_id,changed_by,source,note)
 SELECT id,NULL,_agent,_actor,'extra_manual','Extra allocation — '||coalesce(_reason,'') FROM unnest(moved_ids) id;
 INSERT INTO public.lead_events(lead_id,agent_id,kind,detail)
 SELECT id,_agent,'extra_lead_granted','Extra allocation ('||d::text||') — '||coalesce(_reason,'') FROM unnest(moved_ids) id;
 INSERT INTO public.lead_extra_grants(agent_profile_id,work_date,quantity,reason,source,request_id,granted_by,granted_by_label)
 VALUES(_agent,d,n,_reason,_source,_request,_actor,_label);
 INSERT INTO public.audit_logs(action,entity_type,entity_id,actor_profile_id,actor_label,metadata)
 VALUES('extra_leads_granted','lead_pool',_agent::text,_actor,_label,jsonb_build_object('requested',_quantity,'moved',n,'reason',_reason,'workDate',d));
 RETURN jsonb_build_object('moved',n,'replayed',false,'workDate',d);
END $$;
REVOKE ALL ON FUNCTION public.allocate_extra_leads_atomic(uuid,uuid[],integer,uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_extra_leads_atomic(uuid,uuid[],integer,uuid,text,text,uuid,text) TO service_role;
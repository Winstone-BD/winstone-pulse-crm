CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('call','follow_up','reassignment','note','site_visit','booking','whatsapp','status_change','other')),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_activities_lead_idx ON public.crm_activities (lead_id, occurred_at DESC);
CREATE INDEX crm_activities_agent_idx ON public.crm_activities (agent_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HQ and team leaders read all activity" ON public.crm_activities
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_leader'));

CREATE POLICY "Agents read own or assigned-lead activity" ON public.crm_activities
FOR SELECT TO authenticated
USING (
  actor_user_id = auth.uid()
  OR agent_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  OR lead_id IN (
    SELECT l.id FROM public.leads l JOIN public.profiles p ON p.id IN (l.assigned_agent_id, l.assigned_to)
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users log activity as themselves" ON public.crm_activities
FOR INSERT TO authenticated
WITH CHECK (
  actor_user_id = auth.uid()
  AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'team_leader')
    OR lead_id IS NULL
    OR lead_id IN (
      SELECT l.id FROM public.leads l JOIN public.profiles p ON p.id IN (l.assigned_agent_id, l.assigned_to)
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE TRIGGER crm_activities_append_only
BEFORE UPDATE OR DELETE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();
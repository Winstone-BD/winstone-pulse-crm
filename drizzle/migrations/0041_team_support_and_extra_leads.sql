-- Sales Team Admin role membership (least privilege: support duties only).
CREATE TABLE IF NOT EXISTS public.team_support_admins (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_label text NOT NULL DEFAULT 'sales_team_admin',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_support_admins TO authenticated;
GRANT ALL ON public.team_support_admins TO service_role;
ALTER TABLE public.team_support_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff can read the support admin list"
  ON public.team_support_admins FOR SELECT TO authenticated USING (true);

-- Agent -> Sales Team Admin support tickets (same table for web and Android).
CREATE TABLE IF NOT EXISTS public.team_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,
  agent_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  agent_role text NOT NULL DEFAULT 'agent',
  category text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  platform text NOT NULL DEFAULT 'web',
  device_label text,
  attachment_url text,
  assigned_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_role text NOT NULL DEFAULT 'sales_team_admin',
  unread_for_admin boolean NOT NULL DEFAULT true,
  unread_for_agent boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_support_tickets_agent_idx
  ON public.team_support_tickets(agent_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS team_support_tickets_status_idx
  ON public.team_support_tickets(status, priority, created_at DESC);

GRANT SELECT ON public.team_support_tickets TO authenticated;
GRANT ALL ON public.team_support_tickets TO service_role;
ALTER TABLE public.team_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents read their own support tickets"
  ON public.team_support_tickets FOR SELECT TO authenticated
  USING (
    agent_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_support_admins a
      JOIN public.profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_leader')
  );

CREATE TRIGGER team_support_tickets_touch
  BEFORE UPDATE ON public.team_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Threaded replies on a support ticket.
CREATE TABLE IF NOT EXISTS public.team_support_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.team_support_tickets(id) ON DELETE CASCADE,
  author_kind text NOT NULL,
  author_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_label text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_support_replies_ticket_idx
  ON public.team_support_replies(ticket_id, created_at);
GRANT SELECT ON public.team_support_replies TO authenticated;
GRANT ALL ON public.team_support_replies TO service_role;
ALTER TABLE public.team_support_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read replies on tickets they can see"
  ON public.team_support_replies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.agent_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.team_support_admins a
            JOIN public.profiles p ON p.id = a.profile_id
            WHERE p.user_id = auth.uid()
          )
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'team_leader')
        )
    )
  );

-- Extra (above quota) lead grants, kept separate from the base daily round.
CREATE TABLE IF NOT EXISTS public.lead_extra_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  quantity integer NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'manual_extra',
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_by_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_extra_grants_agent_day_idx
  ON public.lead_extra_grants(agent_profile_id, work_date);
GRANT SELECT ON public.lead_extra_grants TO authenticated;
GRANT ALL ON public.lead_extra_grants TO service_role;
ALTER TABLE public.lead_extra_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read extra lead grants"
  ON public.lead_extra_grants FOR SELECT TO authenticated
  USING (
    agent_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'team_leader')
  );
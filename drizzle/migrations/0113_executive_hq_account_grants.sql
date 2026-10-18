CREATE TABLE public.workspace_role_grants (
 user_id uuid NOT NULL,
 role text NOT NULL CHECK (role = 'executive_hq'),
 granted_at timestamptz NOT NULL DEFAULT now(),
 grant_reason text NOT NULL,
 PRIMARY KEY (user_id, role)
);
GRANT SELECT ON public.workspace_role_grants TO authenticated;
GRANT ALL ON public.workspace_role_grants TO service_role;
ALTER TABLE public.workspace_role_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own workspace roles" ON public.workspace_role_grants FOR SELECT TO authenticated USING (user_id = auth.uid());
COMMENT ON TABLE public.workspace_role_grants IS 'Supplemental Executive HQ account access; never grants IT or LeadHub and never replaces canonical agent ownership.';
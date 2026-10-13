CREATE TABLE public.privileged_account_allowlist (
  email text PRIMARY KEY CHECK (email = lower(email)),
  account_kind text NOT NULL CHECK (account_kind IN ('system_architect','super_admin')),
  provisioned_user_id uuid,
  provisioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.privileged_account_allowlist TO service_role;
ALTER TABLE public.privileged_account_allowlist ENABLE ROW LEVEL SECURITY;

INSERT INTO public.privileged_account_allowlist (email, account_kind) VALUES
  ('zhemongrowth@gmail.com','system_architect'),
  ('trendfluxos@gmail.com','super_admin');

CREATE OR REPLACE FUNCTION public.provision_privileged_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_auth_email text; v_confirmed timestamptz; v_kind text;
BEGIN
  SELECT lower(u.email), u.email_confirmed_at INTO v_auth_email, v_confirmed
    FROM auth.users u WHERE u.id = NEW.user_id;
  IF v_auth_email IS NULL OR v_confirmed IS NULL THEN RETURN NEW; END IF;
  SELECT account_kind INTO v_kind FROM public.privileged_account_allowlist
    WHERE email = v_auth_email AND (provisioned_user_id IS NULL OR provisioned_user_id = NEW.user_id);
  IF v_kind IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.profiles SET approval_status = 'approved', is_active = true
    WHERE user_id = NEW.user_id AND (approval_status IS DISTINCT FROM 'approved' OR is_active IS NOT TRUE);
  UPDATE public.privileged_account_allowlist
    SET provisioned_user_id = NEW.user_id, provisioned_at = COALESCE(provisioned_at, now())
    WHERE email = v_auth_email;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.provision_privileged_account() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_provision_privileged_account
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.provision_privileged_account();
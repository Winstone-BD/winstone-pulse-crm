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

  -- profiles.role is the source that profiles_sync_role mirrors into user_roles.
  UPDATE public.profiles SET role = 'admin', approval_status = 'approved', is_active = true
    WHERE user_id = NEW.user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.privileged_account_allowlist
    SET provisioned_user_id = NEW.user_id, provisioned_at = COALESCE(provisioned_at, now())
    WHERE email = v_auth_email;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.provision_privileged_account() FROM PUBLIC, anon, authenticated;
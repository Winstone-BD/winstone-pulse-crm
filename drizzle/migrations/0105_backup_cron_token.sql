CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE public.crm_backup_secret (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.crm_backup_secret TO service_role;
ALTER TABLE public.crm_backup_secret ENABLE ROW LEVEL SECURITY;
INSERT INTO public.crm_backup_secret (id) VALUES (1) ON CONFLICT DO NOTHING;
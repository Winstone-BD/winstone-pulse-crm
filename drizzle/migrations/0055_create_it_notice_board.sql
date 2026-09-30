CREATE TABLE public.it_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 160),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 2 AND 4000),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'important', 'urgent')),
  audience_type text NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all', 'role', 'accounts')),
  audience_role public.app_role NULL,
  author_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_label text NOT NULL DEFAULT 'IT Council',
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT it_notices_audience_shape CHECK (
    (audience_type = 'role' AND audience_role IS NOT NULL) OR
    (audience_type <> 'role' AND audience_role IS NULL)
  )
);
GRANT ALL ON public.it_notices TO service_role;
ALTER TABLE public.it_notices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.it_notice_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.it_notices(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notice_id, profile_id)
);
GRANT ALL ON public.it_notice_recipients TO service_role;
ALTER TABLE public.it_notice_recipients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.it_notice_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.it_notices(id) ON DELETE CASCADE,
  profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_label text NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.it_notice_replies TO service_role;
ALTER TABLE public.it_notice_replies ENABLE ROW LEVEL SECURITY;

CREATE INDEX it_notices_published_at_idx ON public.it_notices (published_at DESC);
CREATE INDEX it_notice_recipients_profile_idx ON public.it_notice_recipients (profile_id, read_at, created_at DESC);
CREATE INDEX it_notice_replies_notice_idx ON public.it_notice_replies (notice_id, created_at ASC);
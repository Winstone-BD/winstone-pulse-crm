CREATE TABLE public.website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  title text,
  content text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Server-only knowledge cache: read and written by server functions through the
-- service role, so no anon/authenticated grants and no client policies.
GRANT ALL ON public.website_pages TO service_role;

ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER website_pages_touch
BEFORE UPDATE ON public.website_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX website_pages_fetched_at_idx ON public.website_pages (fetched_at DESC);
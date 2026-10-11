-- Server-only access for website visit requests (receiver + server functions use service_role).
REVOKE ALL ON public.website_visit_requests FROM anon, authenticated;
GRANT ALL ON public.website_visit_requests TO service_role;

-- Additive provenance tag for official Hub news; existing origin CHECK untouched.
ALTER TABLE public.market_news ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.market_news ADD CONSTRAINT market_news_source_check
  CHECK (source IS NULL OR source = 'winstone_official');
UPDATE public.market_news SET source = 'winstone_official' WHERE origin = 'official' AND source IS NULL;
COMMENT ON COLUMN public.market_news.source IS 'winstone_official for verbatim Knowledge Hub (winstonebd.com) feed items; NULL otherwise.';
CREATE TABLE public.market_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin text NOT NULL CHECK (origin IN ('auto','manual')),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('pending','published','unpublished')),
  headline text NOT NULL,
  summary text NOT NULL,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text NOT NULL DEFAULT 'market',
  tags text[] NOT NULL DEFAULT '{}',
  sales_insight text,
  source_name text,
  source_url text,
  source_title text,
  retrieved_excerpt text,
  source_published_at timestamptz,
  dedupe_key text NOT NULL UNIQUE,
  ai_model text,
  created_by text NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auto_needs_source CHECK (origin = 'manual' OR (source_url IS NOT NULL AND retrieved_excerpt IS NOT NULL))
);
GRANT ALL ON public.market_news TO service_role;
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;
CREATE INDEX market_news_feed_idx ON public.market_news (status, created_at DESC);

CREATE TABLE public.market_news_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid REFERENCES public.market_news(id),
  action text NOT NULL,
  actor text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.market_news_audit TO service_role;
ALTER TABLE public.market_news_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.market_news_audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'market_news_audit is append-only'; END $$;
CREATE TRIGGER market_news_audit_no_change BEFORE UPDATE OR DELETE ON public.market_news_audit
FOR EACH ROW EXECUTE FUNCTION public.market_news_audit_immutable();

CREATE OR REPLACE FUNCTION public.market_news_no_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'market_news rows are unpublished, never deleted'; END $$;
CREATE TRIGGER market_news_block_delete BEFORE DELETE ON public.market_news
FOR EACH ROW EXECUTE FUNCTION public.market_news_no_delete();

CREATE TABLE public.market_news_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  lease_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'running',
  fetched int DEFAULT 0, added int DEFAULT 0, skipped int DEFAULT 0,
  error text
);
GRANT ALL ON public.market_news_runs TO service_role;
ALTER TABLE public.market_news_runs ENABLE ROW LEVEL SECURITY;
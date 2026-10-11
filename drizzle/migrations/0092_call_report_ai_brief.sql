ALTER TABLE public.call_reports
  ADD COLUMN IF NOT EXISTS ai_brief TEXT,
  ADD COLUMN IF NOT EXISTS ai_brief_at TIMESTAMPTZ;
COMMENT ON COLUMN public.call_reports.ai_brief IS 'Gemini-generated Bengali brief of the submitted report; cached so it is generated once.';
CREATE TYPE public.lead_pipeline_stage AS ENUM ('enquiry', 'proposal', 'offer', 'booking', 'close');
ALTER TABLE public.leads ADD COLUMN pipeline_stage public.lead_pipeline_stage NOT NULL DEFAULT 'enquiry';
COMMENT ON COLUMN public.leads.pipeline_stage IS 'Sales pipeline stage: enquiry -> proposal -> offer -> booking -> close';
CREATE INDEX idx_leads_pipeline_stage ON public.leads (pipeline_stage);
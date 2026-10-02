CREATE INDEX IF NOT EXISTS leads_updated_at_id_idx ON public.leads (updated_at DESC, id);
CREATE INDEX IF NOT EXISTS call_recordings_created_at_id_idx ON public.call_recordings (created_at DESC, id);
CREATE INDEX IF NOT EXISTS lead_events_created_at_id_idx ON public.lead_events (created_at DESC, id);
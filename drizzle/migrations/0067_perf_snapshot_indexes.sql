CREATE INDEX IF NOT EXISTS leads_updated_at_desc_idx ON public.leads (updated_at DESC);
CREATE INDEX IF NOT EXISTS call_recordings_created_at_desc_idx ON public.call_recordings (created_at DESC);
CREATE INDEX IF NOT EXISTS call_reports_status_submitted_idx ON public.call_reports (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS follow_up_events_agent_sched_idx ON public.follow_up_events (agent_id, scheduled_at);
CREATE TABLE public.record_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  table_name text NOT NULL,
  record_id text NOT NULL,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.record_audit_log TO service_role;
ALTER TABLE public.record_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX record_audit_log_at_idx ON public.record_audit_log (at DESC);
CREATE INDEX record_audit_log_rec_idx ON public.record_audit_log (table_name, record_id);
CREATE TRIGGER record_audit_log_immutable BEFORE UPDATE OR DELETE ON public.record_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();

CREATE OR REPLACE FUNCTION public.write_record_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n jsonb; o jsonb; diff jsonb := '{}'::jsonb; k text; act text;
  skip text[] := ARRAY['updated_at','legal_name','search_vector'];
  archived text[] := ARRAY['cancelled','canceled','closed','duplicate_skipped','archived','rejected'];
BEGIN
  n := to_jsonb(NEW);
  IF TG_OP = 'INSERT' THEN
    act := 'created';
  ELSE
    o := to_jsonb(OLD);
    FOR k IN SELECT jsonb_object_keys(n) LOOP
      IF k <> ALL(skip) AND (n->k) IS DISTINCT FROM (o->k) THEN
        diff := diff || jsonb_build_object(k, jsonb_build_object('from', o->k, 'to', n->k));
      END IF;
    END LOOP;
    IF diff = '{}'::jsonb THEN RETURN NEW; END IF;
    act := CASE WHEN diff ? 'status' AND (n->>'status') = ANY(archived) THEN 'archived' ELSE 'edited' END;
  END IF;
  INSERT INTO public.record_audit_log(actor_id, table_name, record_id, action, changes)
  VALUES (auth.uid(), TG_TABLE_NAME, n->>'id', act, diff);
  RETURN NEW;
END $$;

CREATE TRIGGER audit_leads AFTER INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.write_record_audit();
CREATE TRIGGER audit_call_reports AFTER INSERT OR UPDATE ON public.call_reports FOR EACH ROW EXECUTE FUNCTION public.write_record_audit();
CREATE TRIGGER audit_follow_up_events AFTER INSERT OR UPDATE ON public.follow_up_events FOR EACH ROW EXECUTE FUNCTION public.write_record_audit();
CREATE TRIGGER audit_bookings AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.write_record_audit();
CREATE TRIGGER audit_site_visits AFTER INSERT OR UPDATE ON public.site_visits FOR EACH ROW EXECUTE FUNCTION public.write_record_audit();
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.write_record_audit();

CREATE TABLE public.crm_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date date NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'running',
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  size_bytes bigint,
  checksum text,
  error text
);
GRANT ALL ON public.crm_backup_runs TO service_role;
ALTER TABLE public.crm_backup_runs ENABLE ROW LEVEL SECURITY;
-- Approved Google Drive documents, indexed into the CRM as a third-priority
-- knowledge source (live CRM data first, verified website second).
CREATE TABLE public.drive_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text NOT NULL UNIQUE,
  name text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  folder_id text,
  folder_name text,
  web_view_link text,
  modified_time timestamptz,
  content text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Server-only index: read and written by server functions through the service
-- role. Agents never query Drive directly, so no anon/authenticated grants.
GRANT ALL ON public.drive_documents TO service_role;

ALTER TABLE public.drive_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER drive_documents_touch
BEFORE UPDATE ON public.drive_documents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX drive_documents_indexed_at_idx ON public.drive_documents (indexed_at DESC);
CREATE INDEX drive_documents_folder_idx ON public.drive_documents (folder_id);
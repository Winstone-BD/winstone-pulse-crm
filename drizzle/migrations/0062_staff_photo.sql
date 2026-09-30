ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS photo_updated_at timestamptz;
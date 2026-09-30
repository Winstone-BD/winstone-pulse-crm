ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_name text;
COMMENT ON COLUMN public.profiles.legal_name IS 'Name exactly as entered at account creation; never displayed. profiles.name is the display name without MD/MSD/Mohammad prefixes.';

CREATE OR REPLACE FUNCTION public.clean_person_name(_raw text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN cleaned = '' THEN btrim(coalesce(_raw, '')) ELSE cleaned END
  FROM (
    SELECT btrim(regexp_replace(
      regexp_replace(
        ' ' || coalesce(_raw, '') || ' ',
        '(\s)(md|msd|mohd|mohammad|mohammed|mohammod|muhammad|muhammed|mohamad|mohamed)(\.|:)?(?=\s|\.)',
        '\1', 'gi'),
      '(\s)(মোহাম্মদ|মোহাম্মাদ|মুহাম্মদ|মুহাম্মাদ|মোহম্মদ|মোঃ|মো:|মো\.|মোহাঃ)(?=\s)',
      '\1', 'g')) AS pre
  ) s, LATERAL (SELECT btrim(regexp_replace(regexp_replace(pre, '^[\s.:]+', ''), '\s+', ' ', 'g')) AS cleaned) c
$$;

CREATE OR REPLACE FUNCTION public.clean_profile_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.name IS NOT NULL AND public.clean_person_name(NEW.name) <> NEW.name THEN
    NEW.legal_name := NEW.name;
    NEW.name := public.clean_person_name(NEW.name);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_clean_name ON public.profiles;
CREATE TRIGGER profiles_clean_name BEFORE INSERT OR UPDATE OF name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.clean_profile_name();

UPDATE public.profiles SET name = name WHERE name IS NOT NULL AND public.clean_person_name(name) <> name;
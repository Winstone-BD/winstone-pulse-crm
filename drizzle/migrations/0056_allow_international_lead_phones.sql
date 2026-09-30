CREATE OR REPLACE FUNCTION public.normalize_bd_phone(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT CASE
    WHEN digits ~ '^8801[3-9][0-9]{8}$' THEN digits
    WHEN digits ~ '^01[3-9][0-9]{8}$' THEN '88' || digits
    WHEN digits ~ '^1[3-9][0-9]{8}$' THEN '880' || digits
    WHEN btrim(_raw) ~ '^\+[1-9][0-9() .-]{7,20}$' AND digits ~ '^[1-9][0-9]{7,14}$' THEN digits
    WHEN btrim(_raw) ~ '^00[1-9][0-9() .-]{7,20}$' AND regexp_replace(digits, '^00', '') ~ '^[1-9][0-9]{7,14}$' THEN regexp_replace(digits, '^00', '')
    ELSE NULL
  END
  FROM (SELECT regexp_replace(_raw, '[^0-9]', '', 'g') AS digits) s
$$;

CREATE OR REPLACE FUNCTION public.extract_bd_phones(_raw text)
RETURNS SETOF text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  WITH bangladesh AS (
    SELECT DISTINCT public.normalize_bd_phone(m[1]) AS phone
    FROM regexp_matches(
      _raw,
      '(\+?8801[3-9][0-9]{8}|01[3-9][0-9]{8}|1[3-9][0-9]{8})',
      'g'
    ) AS matches(m)
  ), whole_value AS (
    SELECT public.normalize_bd_phone(_raw) AS phone
  )
  SELECT phone FROM bangladesh WHERE phone IS NOT NULL
  UNION
  SELECT phone FROM whole_value WHERE phone IS NOT NULL
$$;

ALTER TABLE public.lead_phone_keys DROP CONSTRAINT lead_phone_keys_canonical_check;
ALTER TABLE public.lead_phone_keys
  ADD CONSTRAINT lead_phone_keys_canonical_check CHECK (canonical_phone ~ '^[1-9][0-9]{7,14}$');

COMMENT ON FUNCTION public.normalize_bd_phone(text) IS 'Canonical international phone identity: Bangladesh local formats normalize to 880..., foreign numbers require +country-code or 00country-code and store as E.164 digits.';
COMMENT ON FUNCTION public.extract_bd_phones(text) IS 'Extracts canonical Bangladesh mobiles and accepts a single international E.164 phone value.';
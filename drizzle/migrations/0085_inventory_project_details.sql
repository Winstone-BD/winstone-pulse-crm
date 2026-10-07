ALTER TABLE public.inventory_requirements
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS total_units integer,
  ADD COLUMN IF NOT EXISTS available_units integer;
ALTER TABLE public.inventory_requirements
  ADD CONSTRAINT inventory_units_valid CHECK (
    (total_units IS NULL OR total_units >= 0) AND
    (available_units IS NULL OR available_units >= 0) AND
    (total_units IS NULL OR available_units IS NULL OR available_units <= total_units)
  );
COMMENT ON COLUMN public.inventory_requirements.total_units IS 'Sales catalogue cache; Winstone OS is the inventory master.';
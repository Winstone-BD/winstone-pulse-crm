-- Secure PIN vault: encrypted current PIN per surface + immutable rotation history.
CREATE TABLE IF NOT EXISTS public.pin_vault (
  surface text PRIMARY KEY,
  secret_cipher text NOT NULL,
  hint text NOT NULL,
  note text,
  updated_by_label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pin_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface text NOT NULL,
  hint text NOT NULL,
  reason text,
  note text,
  actor_label text,
  actor_profile_id uuid REFERENCES public.profiles(id),
  rotated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pin_rotations_surface_time_idx
  ON public.pin_rotations (surface, rotated_at DESC);

-- Server-only tables: reached exclusively through the privileged server client.
GRANT ALL ON public.pin_vault TO service_role;
GRANT ALL ON public.pin_rotations TO service_role;

ALTER TABLE public.pin_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_rotations ENABLE ROW LEVEL SECURITY;
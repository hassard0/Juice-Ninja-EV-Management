ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS default_amps integer NOT NULL DEFAULT 32,
  ADD COLUMN IF NOT EXISTS auto_start boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_connected boolean NOT NULL DEFAULT false;
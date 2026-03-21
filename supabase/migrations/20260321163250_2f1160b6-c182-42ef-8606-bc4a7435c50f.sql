
-- Command queue: chargers poll for pending commands
CREATE TABLE public.device_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  command text NOT NULL, -- 'start', 'stop', 'set_current'
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'acknowledged', 'completed', 'failed'
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  completed_at timestamptz,
  result jsonb
);

ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

-- Users can insert commands for their own devices
CREATE POLICY "Users can insert commands for own devices" ON public.device_commands
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM devices WHERE devices.id = device_commands.device_id AND devices.user_id = auth.uid()));

-- Users can view commands for their own devices
CREATE POLICY "Users can view commands for own devices" ON public.device_commands
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM devices WHERE devices.id = device_commands.device_id AND devices.user_id = auth.uid()));

-- Users can delete commands for their own devices
CREATE POLICY "Users can delete commands for own devices" ON public.device_commands
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM devices WHERE devices.id = device_commands.device_id AND devices.user_id = auth.uid()));

-- Also allow INSERT on telemetry and sessions via service role (edge functions use service role)
-- But also allow INSERT on sessions for authenticated users who own the device
CREATE POLICY "Users can insert sessions for own devices" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM devices WHERE devices.id = sessions.device_id AND devices.user_id = auth.uid()));

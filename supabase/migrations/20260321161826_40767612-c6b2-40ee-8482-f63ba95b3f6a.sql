-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Devices table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  api_key TEXT,
  firmware_type TEXT,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own devices" ON public.devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own devices" ON public.devices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own devices" ON public.devices FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Telemetry table
CREATE TABLE public.telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  amps REAL,
  voltage REAL,
  wh REAL,
  temperature REAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view telemetry for own devices" ON public.telemetry FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.devices WHERE devices.id = telemetry.device_id AND devices.user_id = auth.uid()));

-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  energy_kwh REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  tenant_id INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view sessions for own devices" ON public.sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.devices WHERE devices.id = sessions.device_id AND devices.user_id = auth.uid()));

-- Schedules table
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  days_of_week INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view schedules for own devices" ON public.schedules FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.devices WHERE devices.id = schedules.device_id AND devices.user_id = auth.uid()));
CREATE POLICY "Users can insert schedules for own devices" ON public.schedules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.devices WHERE devices.id = schedules.device_id AND devices.user_id = auth.uid()));
CREATE POLICY "Users can update schedules for own devices" ON public.schedules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.devices WHERE devices.id = schedules.device_id AND devices.user_id = auth.uid()));
CREATE POLICY "Users can delete schedules for own devices" ON public.schedules FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.devices WHERE devices.id = schedules.device_id AND devices.user_id = auth.uid()));
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
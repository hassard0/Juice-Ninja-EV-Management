-- User settings table (currency, preferences)
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'GBP',
  currency_symbol TEXT NOT NULL DEFAULT '£',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tariff rates table (multiple time ranges with different costs)
CREATE TABLE public.tariff_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  cost_per_kwh REAL NOT NULL DEFAULT 0.25,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tariff_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tariffs" ON public.tariff_rates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tariffs" ON public.tariff_rates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tariffs" ON public.tariff_rates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tariffs" ON public.tariff_rates FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_tariff_rates_updated_at BEFORE UPDATE ON public.tariff_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create default settings on signup (update existing function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  INSERT INTO public.tariff_rates (user_id, name, start_time, end_time, cost_per_kwh, is_default)
  VALUES (NEW.id, 'Standard rate', '00:00', '23:59', 0.25, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
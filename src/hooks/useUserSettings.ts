import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUserSettings() {
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ["user_settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return {
    timeFormat: (settings?.time_format as "12h" | "24h") || "24h",
    currency: settings?.currency || "GBP",
    currencySymbol: settings?.currency_symbol || "£",
  };
}

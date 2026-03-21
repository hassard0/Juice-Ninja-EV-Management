import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/time";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import TimeField from "@/components/TimeField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BatteryCharging, ArrowLeft, Save, Loader2, Plus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
type TariffRate = Database["public"]["Tables"]["tariff_rates"]["Row"];

const CURRENCIES = [
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (C$)" },
  { code: "NOK", symbol: "kr", label: "Norwegian Krone (kr)" },
  { code: "SEK", symbol: "kr", label: "Swedish Krona (kr)" },
  { code: "CHF", symbol: "Fr", label: "Swiss Franc (Fr)" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen (¥)" },
  { code: "CNY", symbol: "¥", label: "Chinese Yuan (¥)" },
];

export default function Settings() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [tariffs, setTariffs] = useState<TariffRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [currency, setCurrency] = useState("GBP");
  const [timeFormat, setTimeFormat] = useState<"24h" | "12h">("24h");
  const [addingTariff, setAddingTariff] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("00:00");
  const [newEnd, setNewEnd] = useState("07:00");
  const [newCost, setNewCost] = useState("0.10");
  const timeInputLang = timeFormat === "12h" ? "en-US" : "en-GB";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [settingsRes, tariffsRes] = await Promise.all([
        supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("tariff_rates").select("*").eq("user_id", user.id).order("start_time"),
      ]);
      if (settingsRes.data) {
        setSettings(settingsRes.data);
        setCurrency(settingsRes.data.currency);
        setTimeFormat(settingsRes.data.time_format === "12h" ? "12h" : "24h");
      }
      if (tariffsRes.data) setTariffs(tariffsRes.data);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSaveCurrency = async () => {
    if (!user) return;
    setSavingSettings(true);
    const currencyObj = CURRENCIES.find((c) => c.code === currency);
    if (settings) {
      const { error } = await supabase.from("user_settings").update({
        currency,
        currency_symbol: currencyObj?.symbol || "£",
        time_format: timeFormat,
      }).eq("user_id", user.id);
      if (error) toast.error(error.message);
      else toast.success("Currency updated");
    } else {
      const { error } = await supabase.from("user_settings").insert({
        user_id: user.id,
        currency,
        currency_symbol: currencyObj?.symbol || "£",
        time_format: timeFormat,
      });
      if (error) toast.error(error.message);
      else toast.success("Settings saved");
    }
    setSavingSettings(false);
  };

  const handleAddTariff = async () => {
    if (!user || !newName.trim()) return;
    setAddingTariff(true);
    const { error } = await supabase.from("tariff_rates").insert({
      user_id: user.id,
      name: newName.trim(),
      start_time: newStart,
      end_time: newEnd,
      cost_per_kwh: parseFloat(newCost) || 0.25,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Tariff rate added");
      setNewName("");
      setNewStart("00:00");
      setNewEnd("07:00");
      setNewCost("0.10");
      const { data } = await supabase.from("tariff_rates").select("*").eq("user_id", user.id).order("start_time");
      if (data) setTariffs(data);
    }
    setAddingTariff(false);
  };

  const handleUpdateTariff = async (tariff: TariffRate, field: string, value: string | number) => {
    const { error } = await supabase.from("tariff_rates").update({ [field]: value }).eq("id", tariff.id);
    if (error) toast.error(error.message);
    else {
      setTariffs((prev) => prev.map((t) => (t.id === tariff.id ? { ...t, [field]: value } : t)));
      toast.success("Tariff updated");
    }
  };

  const handleDeleteTariff = async (id: string) => {
    const { error } = await supabase.from("tariff_rates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setTariffs((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tariff deleted");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currencyObj = CURRENCIES.find((c) => c.code === currency);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/dashboard" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <BatteryCharging className="h-6 w-6" />
            Juice Ninja
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Profile info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm"><span className="text-muted-foreground">Email:</span> {user?.email}</p>
            <p className="text-sm"><span className="text-muted-foreground">Name:</span> {user?.user_metadata?.full_name || "—"}</p>
            <Button variant="outline" size="sm" onClick={signOut} className="mt-3">Sign out</Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferences</CardTitle>
            <CardDescription>Currency and display settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Time format</Label>
                <Select value={timeFormat} onValueChange={(value) => setTimeFormat(value === "12h" ? "12h" : "24h")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24-hour (14:30)</SelectItem>
                    <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSaveCurrency} disabled={savingSettings} className="active:scale-[0.97] transition-transform">
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save preferences
            </Button>
          </CardContent>
        </Card>

        {/* Tariff rates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Energy tariff rates</CardTitle>
            <CardDescription>Set different rates for different times of day (e.g. off-peak, peak, overnight)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tariffs.map((tariff) => (
              <div key={tariff.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium text-sm">{tariff.name}</span>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatTime(tariff.start_time, timeFormat)} — {formatTime(tariff.end_time, timeFormat)}
                      </p>
                    </div>
                    {tariff.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                  </div>
                  {!tariff.is_default && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteTariff(tariff.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start · {formatTime(tariff.start_time, timeFormat)}</Label>
                    <Input
                      type="time"
                      lang={timeInputLang}
                      value={tariff.start_time.slice(0, 5)}
                      onChange={(e) => handleUpdateTariff(tariff, "start_time", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End · {formatTime(tariff.end_time, timeFormat)}</Label>
                    <Input
                      type="time"
                      lang={timeInputLang}
                      value={tariff.end_time.slice(0, 5)}
                      onChange={(e) => handleUpdateTariff(tariff, "end_time", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cost ({currencyObj?.symbol}/kWh)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tariff.cost_per_kwh}
                      onChange={(e) => handleUpdateTariff(tariff, "cost_per_kwh", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-medium">Add tariff rate</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Rate name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Off-peak overnight" maxLength={50} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start · {formatTime(newStart, timeFormat)}</Label>
                    <Input type="time" lang={timeInputLang} value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End · {formatTime(newEnd, timeFormat)}</Label>
                    <Input type="time" lang={timeInputLang} value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cost ({currencyObj?.symbol}/kWh)</Label>
                    <Input type="number" step="0.01" min="0" value={newCost} onChange={(e) => setNewCost(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" onClick={handleAddTariff} disabled={addingTariff || !newName.trim()} className="active:scale-[0.97] transition-transform">
                  {addingTariff ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add rate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { formatTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TimeField from "@/components/TimeField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BatteryCharging, ArrowLeft, Zap, Activity, Thermometer, Wifi, WifiOff, Loader2, Clock, Plus, Play, Square, Trash2, ChevronLeft, ChevronRight, Car } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";
import ChargerSettingsDialog from "@/components/ChargerSettingsDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type Device = Database["public"]["Tables"]["devices"]["Row"];
type Schedule = Database["public"]["Tables"]["schedules"]["Row"];
type Telemetry = Database["public"]["Tables"]["telemetry"]["Row"];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { timeFormat } = useUserSettings();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [newStartTime, setNewStartTime] = useState("23:00");
  const [newEndTime, setNewEndTime] = useState("07:00");
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);
  

  // Chart date navigation — offset in days from today (0 = today, -1 = yesterday, etc.)
  const [chartDayOffset, setChartDayOffset] = useState(0);

  const { data: device, isLoading: loading } = useQuery<Device | null>({
    queryKey: ["device", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("devices").select("*").eq("id", id).single();
      if (error || !data) {
        toast.error("Charger not found");
        navigate("/dashboard");
        return null;
      }
      return data;
    },
    enabled: !!id,
    refetchInterval: 15000,
  });

  const fetchSchedules = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("schedules").select("*").eq("device_id", id).order("start_time");
    if (data) setSchedules(data);
  }, [id]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Compute chart date range based on offset
  const chartRange = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + chartDayOffset + 1);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    return { start, end };
  }, [chartDayOffset]);

  const chartDateLabel = useMemo(() => {
    if (chartDayOffset === 0) return "Today";
    if (chartDayOffset === -1) return "Yesterday";
    const d = new Date();
    d.setDate(d.getDate() + chartDayOffset);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }, [chartDayOffset]);

  // Fetch telemetry for the selected chart day
  const { data: rawTelemetry = [] } = useQuery<Telemetry[]>({
    queryKey: ["telemetry_device_day", id, chartDayOffset],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("telemetry")
        .select("*")
        .eq("device_id", id)
        .gte("recorded_at", chartRange.start.toISOString())
        .lt("recorded_at", chartRange.end.toISOString())
        .order("recorded_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
    refetchInterval: chartDayOffset === 0 ? 30000 : false,
  });

  // Group telemetry by hour for charts
  const telemetryByHour = useMemo(() => {
    if (rawTelemetry.length === 0) return [];
    const hourMap: Record<string, { amps: number[]; voltage: number[]; wh: number[]; temp: number[] }> = {};
    for (const t of rawTelemetry) {
      const d = new Date(t.recorded_at);
      const key = `${String(d.getHours()).padStart(2, "0")}:00`;
      if (!hourMap[key]) hourMap[key] = { amps: [], voltage: [], wh: [], temp: [] };
      if (t.amps != null) hourMap[key].amps.push(t.amps);
      if (t.voltage != null) hourMap[key].voltage.push(t.voltage);
      if (t.wh != null) hourMap[key].wh.push(t.wh);
      if (t.temperature != null) hourMap[key].temp.push(t.temperature);
    }
    return Object.entries(hourMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, vals]) => ({
        hour,
        amps: vals.amps.length ? vals.amps.reduce((a, b) => a + b, 0) / vals.amps.length : 0,
        voltage: vals.voltage.length ? vals.voltage.reduce((a, b) => a + b, 0) / vals.voltage.length : 0,
        kwh: vals.wh.length ? Math.max(...vals.wh) / 1000 : 0,
        temp: vals.temp.length ? vals.temp.reduce((a, b) => a + b, 0) / vals.temp.length : 0,
      }));
  }, [rawTelemetry]);

  // Latest telemetry values (always from today's data or latest available)
  const latest = rawTelemetry.length > 0 && chartDayOffset === 0 ? rawTelemetry[rawTelemetry.length - 1] : null;
  const latestAge = device ? Date.now() - new Date(device.updated_at).getTime() : Infinity;

  const vehicleConnected = (device as any)?.vehicle_connected ?? false;

  const handleAddSchedule = async () => {
    if (!device || !user) return;
    setAddingSchedule(true);
    const { error } = await supabase.from("schedules").insert({
      device_id: device.id,
      start_time: newStartTime,
      end_time: newEndTime,
      days_of_week: newDays,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Schedule added");
      fetchSchedules();
    }
    setAddingSchedule(false);
  };

  const handleToggleSchedule = async (schedule: Schedule) => {
    const { error } = await supabase.from("schedules").update({ enabled: !schedule.enabled }).eq("id", schedule.id);
    if (error) toast.error(error.message);
    else setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, enabled: !s.enabled } : s)));
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const { error } = await supabase.from("schedules").delete().eq("id", scheduleId);
    if (error) toast.error(error.message);
    else setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
  };

  if (loading || !device) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentAmps = latest?.amps ?? 0;
  const currentVoltage = latest?.voltage ?? 0;
  const currentTemp = latest?.temperature ?? null;
  const totalWh = latest?.wh ?? 0;
  const latestTeleAge = latest ? Date.now() - new Date(latest.recorded_at).getTime() : Infinity;
  const isCharging = currentAmps > 1 && latestTeleAge < 2 * 60 * 1000;
  const isOnline = latestAge < 5 * 60 * 1000;

  // Can go back up to 365 days
  const canGoBack = chartDayOffset > -365;
  const canGoForward = chartDayOffset < 0;

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

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header with gear icon */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold truncate">{device.name}</h1>
                <ChargerSettingsDialog device={device} onUpdated={() => queryClient.invalidateQueries({ queryKey: ["device", id] })} />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {device.firmware_type || "Unknown firmware"}{device.url ? ` · ${device.url}` : ""}
                {(device as any).timezone ? ` · ${(device as any).timezone.replace(/_/g, " ")}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-11 sm:ml-0">
            {vehicleConnected && (
              <Badge className="bg-primary/10 text-primary text-xs">
                <Car className="h-3 w-3 mr-1" /> Connected
              </Badge>
            )}
            <Badge className={`text-xs ${isOnline ? "bg-primary text-primary-foreground" : "bg-destructive/15 text-destructive"}`}>
              {isOnline ? <><Wifi className="h-3 w-3 mr-1" /> Online</> : <><WifiOff className="h-3 w-3 mr-1" /> Offline</>}
            </Badge>
          </div>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Status", value: isCharging ? "Charging" : "Idle", icon: BatteryCharging },
            { label: "Current", value: `${currentAmps.toFixed(1)} A`, icon: Activity },
            { label: "Voltage", value: `${currentVoltage.toFixed(0)} V`, icon: Zap },
            { label: "Temperature", value: currentTemp != null ? `${currentTemp.toFixed(0)}°C` : "—", icon: Thermometer },
            { label: "Session energy", value: `${(totalWh / 1000).toFixed(1)} kWh`, icon: Zap },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><s.icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold tabular-nums">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick controls */}
        <div className="flex flex-wrap gap-3">
          <Button
            className="active:scale-[0.97] transition-transform"
            disabled={!isOnline || !vehicleConnected || isCharging}
            onClick={async () => {
              const { error } = await supabase.from("device_commands").insert({ device_id: device.id, command: "start" });
              if (error) toast.error(error.message);
              else toast.success("Start command queued — charger will pick it up on next poll");
            }}
          >
            <Play className="h-4 w-4 mr-1" /> Start charging
          </Button>
          <Button
            variant="destructive"
            className="active:scale-[0.97] transition-transform"
            disabled={!isOnline || !isCharging}
            onClick={async () => {
              const { error } = await supabase.from("device_commands").insert({ device_id: device.id, command: "stop" });
              if (error) toast.error(error.message);
              else toast.success("Stop command queued — charger will pick it up on next poll");
            }}
          >
            <Square className="h-4 w-4 mr-1" /> Stop charging
          </Button>
          {!vehicleConnected && isOnline && (
            <p className="text-sm text-muted-foreground self-center ml-2">Plug in a vehicle to enable controls</p>
          )}
        </div>

        {/* Telemetry charts with date navigation */}
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Telemetry</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canGoBack} onClick={() => setChartDayOffset((o) => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium tabular-nums min-w-[100px] text-center">{chartDateLabel}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canGoForward} onClick={() => setChartDayOffset((o) => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {chartDayOffset !== 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setChartDayOffset(0)} className="text-xs">
                    Today
                  </Button>
                )}
              </div>
            </div>

          {telemetryByHour.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Energy</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={telemetryByHour} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={3} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit=" kWh" width={52} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }} />
                      <Bar dataKey="kwh" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Current & voltage</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={telemetryByHour}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={3} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }} />
                      <Line type="monotone" dataKey="amps" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Amps" />
                      <Line type="monotone" dataKey="voltage" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Voltage" yAxisId={0} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {chartDayOffset === 0
                    ? "No telemetry data today. Charts will appear once the charger sends meter values."
                    : `No telemetry data for ${chartDateLabel}.`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Schedules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Charging schedules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium tabular-nums">{formatTime(schedule.start_time, timeFormat)} — {formatTime(schedule.end_time, timeFormat)}</p>
                    <p className="text-xs text-muted-foreground">{schedule.days_of_week.map((d) => DAYS[d - 1]).join(", ")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={schedule.enabled} onCheckedChange={() => handleToggleSchedule(schedule)} />
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteSchedule(schedule.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}

            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No schedules yet. Add one to automate your charging.</p>
            )}

            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Add schedule</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start time · {formatTime(newStartTime, timeFormat)}</Label>
                  <TimeField value={newStartTime} format={timeFormat} onChange={setNewStartTime} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End time · {formatTime(newEndTime, timeFormat)}</Label>
                  <TimeField value={newEndTime} format={timeFormat} onChange={setNewEndTime} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Days</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((day, i) => {
                    const dayNum = i + 1;
                    const selected = newDays.includes(dayNum);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setNewDays((prev) => selected ? prev.filter((d) => d !== dayNum) : [...prev, dayNum])}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button size="sm" onClick={handleAddSchedule} disabled={addingSchedule || newDays.length === 0} className="active:scale-[0.97] transition-transform">
                {addingSchedule ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Add schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

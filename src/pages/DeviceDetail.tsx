import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BatteryCharging, ArrowLeft, Zap, Activity, Thermometer, Wifi, WifiOff, Trash2, Save, Loader2, Clock, Plus, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";
import type { Database } from "@/integrations/supabase/types";

type Device = Database["public"]["Tables"]["devices"]["Row"];
type Schedule = Database["public"]["Tables"]["schedules"]["Row"];

// Mock telemetry for demo (until real charger integration)
const generateMockTelemetry = () => {
  const data = [];
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    const charging = Math.random() > 0.4;
    data.push({
      hour: `${String(23 - i).padStart(2, "0")}:00`,
      amps: charging ? 8 + Math.random() * 24 : 0,
      voltage: 230 + Math.random() * 15,
      kwh: charging ? 1.5 + Math.random() * 5 : 0,
      temp: 18 + Math.random() * 20,
    });
  }
  return data;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [firmwareType, setFirmwareType] = useState("");
  const [telemetry] = useState(generateMockTelemetry);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [newStartTime, setNewStartTime] = useState("23:00");
  const [newEndTime, setNewEndTime] = useState("07:00");
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const isOnline = device != null; // Simulated

  useEffect(() => {
    if (!id) return;
    const fetchDevice = async () => {
      const { data, error } = await supabase.from("devices").select("*").eq("id", id).single();
      if (error || !data) {
        toast.error("Charger not found");
        navigate("/dashboard");
        return;
      }
      setDevice(data);
      setName(data.name);
      setUrl(data.url || "");
      setApiKey(data.api_key || "");
      setFirmwareType(data.firmware_type || "");
      setLoading(false);
    };
    const fetchSchedules = async () => {
      const { data } = await supabase.from("schedules").select("*").eq("device_id", id).order("start_time");
      if (data) setSchedules(data);
    };
    fetchDevice();
    fetchSchedules();
  }, [id, navigate]);

  const handleSave = async () => {
    if (!device) return;
    setSaving(true);
    const { error } = await supabase.from("devices").update({
      name: name.trim(),
      url: url.trim() || null,
      api_key: apiKey.trim() || null,
      firmware_type: firmwareType || null,
    }).eq("id", device.id);
    if (error) toast.error(error.message);
    else toast.success("Charger updated");
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!device || !confirm("Delete this charger? This cannot be undone.")) return;
    const { error } = await supabase.from("devices").delete().eq("id", device.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Charger deleted");
      navigate("/dashboard");
    }
  };

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
      const { data } = await supabase.from("schedules").select("*").eq("device_id", device.id).order("start_time");
      if (data) setSchedules(data);
    }
    setAddingSchedule(false);
  };

  const handleToggleSchedule = async (schedule: Schedule) => {
    const { error } = await supabase.from("schedules").update({ enabled: !schedule.enabled }).eq("id", schedule.id);
    if (error) toast.error(error.message);
    else {
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, enabled: !s.enabled } : s)));
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const { error } = await supabase.from("schedules").delete().eq("id", scheduleId);
    if (error) toast.error(error.message);
    else setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentAmps = telemetry[telemetry.length - 1]?.amps ?? 0;
  const currentVoltage = telemetry[telemetry.length - 1]?.voltage ?? 0;
  const currentTemp = telemetry[telemetry.length - 1]?.temp ?? 0;
  const totalKwh = telemetry.reduce((sum, t) => sum + t.kwh, 0);
  const isCharging = currentAmps > 1;

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

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{device?.name}</h1>
            <p className="text-sm text-muted-foreground">Firmware: {device?.firmware_type || "Unknown"}</p>
          </div>
          <Badge className={isOnline ? "bg-primary text-primary-foreground" : "bg-destructive/15 text-destructive"}>
            {isOnline ? <><Wifi className="h-3 w-3 mr-1" /> Online</> : <><WifiOff className="h-3 w-3 mr-1" /> Offline</>}
          </Badge>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Status", value: isCharging ? "Charging" : "Idle", icon: BatteryCharging },
            { label: "Current", value: `${currentAmps.toFixed(1)} A`, icon: Activity },
            { label: "Voltage", value: `${currentVoltage.toFixed(0)} V`, icon: Zap },
            { label: "Temperature", value: `${currentTemp.toFixed(0)}°C`, icon: Thermometer },
            { label: "Session total", value: `${totalKwh.toFixed(1)} kWh`, icon: Zap },
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
        <div className="flex gap-3">
          <Button className="active:scale-[0.97] transition-transform" onClick={async () => {
            const { error } = await supabase.from("device_commands").insert({ device_id: device!.id, command: "start" });
            if (error) toast.error(error.message);
            else toast.success("Start command queued — charger will pick it up on next poll");
          }}>
            <Play className="h-4 w-4 mr-1" /> Start charging
          </Button>
          <Button variant="destructive" className="active:scale-[0.97] transition-transform" onClick={async () => {
            const { error } = await supabase.from("device_commands").insert({ device_id: device!.id, command: "stop" });
            if (error) toast.error(error.message);
            else toast.success("Stop command queued — charger will pick it up on next poll");
          }}>
            <Square className="h-4 w-4 mr-1" /> Stop charging
          </Button>
        </div>

        {/* Telemetry charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Energy (24h)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={telemetry} barSize={14}>
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
            <CardHeader><CardTitle className="text-base">Current & voltage (24h)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={telemetry}>
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

        {/* Schedules */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Charging schedules</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium tabular-nums">{schedule.start_time.slice(0, 5)} — {schedule.end_time.slice(0, 5)}</p>
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
                  <Label className="text-xs">Start time</Label>
                  <Input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End time</Label>
                  <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Days</Label>
                <div className="flex gap-1.5">
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

        {/* Device settings */}
        <Card>
          <CardHeader><CardTitle className="text-base">Charger settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>URL / IP</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>API key</Label>
                <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" />
              </div>
              <div className="space-y-2">
                <Label>Firmware</Label>
                <Select value={firmwareType} onValueChange={setFirmwareType}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openevse">OpenEVSE</SelectItem>
                    <SelectItem value="ocpp">OCPP 1.6</SelectItem>
                    <SelectItem value="wallbox">Wallbox</SelectItem>
                    <SelectItem value="zappi">myenergi Zappi</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} className="active:scale-[0.97] transition-transform">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save changes
              </Button>
              <Button variant="destructive" onClick={handleDelete} className="active:scale-[0.97] transition-transform">
                <Trash2 className="h-4 w-4 mr-1" /> Delete charger
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

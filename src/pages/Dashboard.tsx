import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BatteryCharging, Zap, Activity, Thermometer, LogOut, Play, Square, Clock, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import AddChargerDialog from "@/components/AddChargerDialog";
import type { Database } from "@/integrations/supabase/types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

const statusForDevice = (device: Device): "charging" | "idle" | "offline" | "scheduled" => {
  // Simulated status — in production this would come from telemetry
  const hash = device.id.charCodeAt(0) % 4;
  return (["charging", "idle", "scheduled", "idle"] as const)[hash];
};

const statusColor: Record<string, string> = {
  charging: "bg-primary text-primary-foreground",
  idle: "bg-muted text-muted-foreground",
  offline: "bg-destructive/15 text-destructive",
  scheduled: "bg-accent text-accent-foreground",
};

// Mock telemetry per device (demo)
const mockTelemetry = (device: Device) => {
  const seed = device.id.charCodeAt(2);
  const status = statusForDevice(device);
  return {
    amps: status === "charging" ? 8 + (seed % 24) : 0,
    voltage: 230 + (seed % 15),
    power_kw: status === "charging" ? ((8 + (seed % 24)) * (230 + (seed % 15))) / 1000 : 0,
    session_kwh: status === "charging" ? 2 + (seed % 30) : 0,
    temperature: 18 + (seed % 20),
  };
};

const mockEnergyData = [
  { day: "Mon", kwh: 28.4 },
  { day: "Tue", kwh: 34.1 },
  { day: "Wed", kwh: 19.7 },
  { day: "Thu", kwh: 42.3 },
  { day: "Fri", kwh: 37.9 },
  { day: "Sat", kwh: 15.2 },
  { day: "Sun", kwh: 22.8 },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();

  const { data: devices = [], refetch } = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Device[];
    },
  });

  const activeCount = devices.filter((d) => statusForDevice(d) === "charging").length;
  const totalKwhToday = devices.reduce((sum, d) => sum + mockTelemetry(d).session_kwh, 0);
  const totalCostToday = totalKwhToday * 0.25;

  const handleStartStop = (device: Device) => {
    const status = statusForDevice(device);
    if (status === "charging") {
      toast.success(`Stopped charging on ${device.name}`);
    } else {
      toast.success(`Started charging on ${device.name}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/dashboard" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <BatteryCharging className="h-6 w-6" />
            Juice Ninja
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Zap className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Energy today</p>
                  <p className="text-2xl font-bold tabular-nums">{totalKwhToday.toFixed(1)} kWh</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><Activity className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Active sessions</p>
                  <p className="text-2xl font-bold tabular-nums">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><BatteryCharging className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Chargers</p>
                  <p className="text-2xl font-bold tabular-nums">{devices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-accent/20 p-2 text-accent-foreground"><BarChart3 className="h-5 w-5" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Cost today</p>
                  <p className="text-2xl font-bold tabular-nums">£{totalCostToday.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charger list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your chargers</h2>
            <AddChargerDialog onAdded={() => refetch()} />
          </div>

          {devices.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BatteryCharging className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-1">No chargers yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Register your first EV charger to start monitoring and controlling it.</p>
                <AddChargerDialog onAdded={() => refetch()} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.map((device) => {
                const status = statusForDevice(device);
                const tele = mockTelemetry(device);
                return (
                  <Link to={`/device/${device.id}`} key={device.id} className="block">
                    <Card className="hover:shadow-md transition-shadow duration-300 h-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{device.name}</CardTitle>
                          <Badge className={`${statusColor[status]} text-xs capitalize`}>{status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Firmware {device.firmware_type || "—"}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Zap className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{tele.power_kw.toFixed(2)} kW</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Activity className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{tele.amps.toFixed(1)} A</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Thermometer className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{tele.temperature}°C</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <BatteryCharging className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{tele.session_kwh.toFixed(1)} kWh</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={status === "charging" ? "destructive" : "default"}
                          className="w-full active:scale-[0.97] transition-transform"
                          onClick={(e) => { e.preventDefault(); handleStartStop(device); }}
                          disabled={status === "offline"}
                        >
                          {status === "charging" ? (
                            <><Square className="h-3.5 w-3.5 mr-1" /> Stop</>
                          ) : (
                            <><Play className="h-3.5 w-3.5 mr-1" /> Start</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Weekly energy chart */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Weekly energy usage</h2>
          <Card>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mockEnergyData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 13 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 13 }} tickLine={false} axisLine={false} unit=" kWh" width={64} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [`${value} kWh`, "Energy"]}
                  />
                  <Bar dataKey="kwh" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BatteryCharging, Zap, Activity, Thermometer, LogOut, Plus, Play, Square, Clock, BarChart3 } from "lucide-react";
import { mockDevices, mockSessions, mockEnergyData, type MockDevice } from "@/lib/mock-data";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { useState } from "react";
import { toast } from "sonner";

const statusColor: Record<MockDevice["status"], string> = {
  charging: "bg-primary text-primary-foreground",
  idle: "bg-muted text-muted-foreground",
  offline: "bg-destructive/15 text-destructive",
  scheduled: "bg-accent text-accent-foreground",
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [devices] = useState(mockDevices);

  const activeCount = devices.filter((d) => d.status === "charging").length;
  const totalKwhToday = mockSessions.reduce((sum, s) => sum + s.energy_kwh, 0);
  const totalCostToday = mockSessions.reduce((sum, s) => sum + s.cost, 0);

  const handleStartStop = (device: MockDevice) => {
    if (device.status === "charging") {
      toast.success(`Stopped charging on ${device.name}`);
    } else {
      toast.success(`Started charging on ${device.name}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <Button size="sm" variant="outline" className="active:scale-[0.97] transition-transform">
              <Plus className="h-4 w-4 mr-1" /> Add charger
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <Card key={device.id} className="hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{device.name}</CardTitle>
                    <Badge className={`${statusColor[device.status]} text-xs capitalize`}>{device.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Firmware {device.firmware}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Zap className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{device.power_kw.toFixed(2)} kW</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{device.amps.toFixed(1)} A</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Thermometer className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{device.temperature}°C</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <BatteryCharging className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{device.session_kwh.toFixed(1)} kWh</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={device.status === "charging" ? "destructive" : "default"}
                    className="w-full active:scale-[0.97] transition-transform"
                    onClick={() => handleStartStop(device)}
                    disabled={device.status === "offline"}
                  >
                    {device.status === "charging" ? (
                      <><Square className="h-3.5 w-3.5 mr-1" /> Stop</>
                    ) : (
                      <><Play className="h-3.5 w-3.5 mr-1" /> Start</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
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

        {/* Recent sessions */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent sessions</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-4 font-medium text-muted-foreground">Charger</th>
                      <th className="p-4 font-medium text-muted-foreground">Started</th>
                      <th className="p-4 font-medium text-muted-foreground">Duration</th>
                      <th className="p-4 font-medium text-muted-foreground text-right">Energy</th>
                      <th className="p-4 font-medium text-muted-foreground text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockSessions.map((session) => {
                      const start = new Date(session.start);
                      const end = session.end ? new Date(session.end) : null;
                      const durationMs = end ? end.getTime() - start.getTime() : Date.now() - start.getTime();
                      const hours = Math.floor(durationMs / 3600000);
                      const mins = Math.floor((durationMs % 3600000) / 60000);
                      return (
                        <tr key={session.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="p-4 font-medium">{session.device_name}</td>
                          <td className="p-4 text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground tabular-nums">
                            {end ? `${hours}h ${mins}m` : <Badge variant="outline" className="text-xs">Active</Badge>}
                          </td>
                          <td className="p-4 text-right tabular-nums font-medium">{session.energy_kwh.toFixed(1)} kWh</td>
                          <td className="p-4 text-right tabular-nums font-medium">£{session.cost.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

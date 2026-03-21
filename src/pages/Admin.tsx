import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Users, Zap, Activity, Battery, Loader2, ShieldCheck } from "lucide-react";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  created_at: string;
}

interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  firmware_type: string | null;
  max_amps: number;
  updated_at: string;
  vehicle_connected: boolean;
}

interface SessionRow {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
  energy_kwh: number | null;
  cost: number | null;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    const load = async () => {
      const [p, d, s] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, created_at").order("created_at", { ascending: false }),
        supabase.from("devices").select("id, user_id, name, firmware_type, max_amps, updated_at, vehicle_connected").order("created_at", { ascending: false }),
        supabase.from("sessions").select("id, device_id, started_at, ended_at, energy_kwh, cost").order("started_at", { ascending: false }).limit(50),
      ]);
      setProfiles((p.data as ProfileRow[]) || []);
      setDevices((d.data as DeviceRow[]) || []);
      setSessions((s.data as SessionRow[]) || []);
      setLoading(false);
    };

    load();
  }, [isAdmin, adminLoading, navigate]);

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const now = Date.now();
  const onlineDevices = devices.filter(d => now - new Date(d.updated_at).getTime() < 5 * 60 * 1000);
  const connectedVehicles = devices.filter(d => d.vehicle_connected);
  const totalEnergy = sessions.reduce((sum, s) => sum + (s.energy_kwh || 0), 0);

  const userDeviceCount = (userId: string) => devices.filter(d => d.user_id === userId).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="active:scale-[0.97]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Admin Dashboard</h1>
          <Badge variant="outline" className="ml-auto text-xs">
            {user?.email}
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{profiles.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" /> Chargers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{devices.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{onlineDevices.length} online</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Battery className="h-4 w-4" /> Vehicles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{connectedVehicles.length}</p>
              <p className="text-xs text-muted-foreground mt-1">connected now</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" /> Energy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{totalEnergy.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-1">kWh total</p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registered Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-right">Chargers</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{p.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-right tabular-nums">{userDeviceCount(p.user_id)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No users yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Devices table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Chargers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Max Amps</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => {
                  const online = now - new Date(d.updated_at).getTime() < 5 * 60 * 1000;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{d.firmware_type || "http"}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{d.max_amps}A</TableCell>
                      <TableCell>
                        <Badge className={online ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}>
                          {online ? "Online" : "Offline"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(d.updated_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {devices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No chargers</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead className="text-right">Energy (kWh)</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const dev = devices.find(d => d.id === s.device_id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{dev?.name || s.device_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">{new Date(s.started_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{s.ended_at ? new Date(s.ended_at).toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{(s.energy_kwh ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">${(s.cost ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No sessions yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

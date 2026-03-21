import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Save, Loader2, Trash2, Copy, Check, KeyRound, Wifi, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type Device = Database["public"]["Tables"]["devices"]["Row"];

interface ChargerSettingsDialogProps {
  device: Device;
  onUpdated: () => void;
}

function generateApiKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "jn_";
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

const FIRMWARE_OPTIONS = [
  { value: "openevse", label: "OpenEVSE" },
  { value: "ocpp", label: "OCPP 1.6" },
  { value: "wallbox", label: "Wallbox" },
  { value: "zappi", label: "myenergi Zappi" },
  { value: "grizzl-e", label: "Grizzl-E" },
  { value: "emporia", label: "Emporia" },
  { value: "custom_http", label: "Custom HTTP" },
  { value: "other", label: "Other" },
];

export default function ChargerSettingsDialog({ device, onUpdated }: ChargerSettingsDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(device.name);
  const [firmwareType, setFirmwareType] = useState(device.firmware_type || "");
  const [location, setLocation] = useState(device.url || "");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/telemetry-webhook`;
  const commandsUrl = `https://${projectId}.supabase.co/functions/v1/device-commands`;

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      toast.error("Name is required and must be under 100 characters");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("devices").update({
      name: trimmedName,
      firmware_type: firmwareType || null,
      url: location.trim() || null,
    }).eq("id", device.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Charger updated");
      onUpdated();
    }
    setSaving(false);
  };

  const handleRegenerateKey = async () => {
    if (!confirm("Regenerate API key? Your charger will need to be reconfigured with the new key.")) return;
    setRegenerating(true);
    const newKey = generateApiKey();
    const { error } = await supabase.from("devices").update({ api_key: newKey }).eq("id", device.id);
    if (error) toast.error(error.message);
    else {
      toast.success("API key regenerated — copy the new key below");
      onUpdated();
    }
    setRegenerating(false);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("devices").delete().eq("id", device.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Charger deleted");
      setOpen(false);
      navigate("/dashboard");
    }
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button size="icon" variant="outline" onClick={() => handleCopy(text, field)} className="shrink-0 h-8 w-8">
      {copiedField === field ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Charger settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Charger settings</DialogTitle>
          <DialogDescription>{device.name} — {device.firmware_type || "Unknown firmware"}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="connection" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="connection" className="flex-1">Connection</TabsTrigger>
            <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="danger" className="flex-1">Danger zone</TabsTrigger>
          </TabsList>

          {/* Connection tab — webhook URLs, device ID, API key */}
          <TabsContent value="connection" className="space-y-5 mt-4">
            <p className="text-sm text-muted-foreground">Configure your charger firmware to connect to Juice Ninja using these credentials.</p>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5" /> Device ID
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono break-all select-all">{device.id}</code>
                  <CopyButton text={device.id} field="id" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> API Key
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono break-all select-all">
                    {device.api_key || "Not set"}
                  </code>
                  {device.api_key && <CopyButton text={device.api_key} field="key" />}
                </div>
                <Button size="sm" variant="outline" onClick={handleRegenerateKey} disabled={regenerating} className="mt-1">
                  {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                  Regenerate key
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Telemetry endpoint</Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-md border bg-background px-3 py-2 text-xs font-mono break-all select-all">{webhookUrl}</code>
                  <CopyButton text={webhookUrl} field="webhook" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Commands endpoint</Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-md border bg-background px-3 py-2 text-xs font-mono break-all select-all">{commandsUrl}</code>
                  <CopyButton text={commandsUrl} field="commands" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium">Example request</p>
              <p className="text-xs text-muted-foreground">Configure your charger to <strong>POST</strong> telemetry with these headers:</p>
              <code className="block rounded-md border bg-background p-3 text-xs font-mono whitespace-pre text-muted-foreground">
{`POST ${webhookUrl}
x-device-id: ${device.id.slice(0, 8)}...
x-api-key: ${(device.api_key || "").slice(0, 12)}...
Content-Type: application/json

{
  "amps": 16.2,
  "voltage": 238,
  "wh": 1450,
  "temperature": 32.5
}`}
              </code>
              <p className="text-xs text-muted-foreground">Pending commands are returned in the response, or poll the commands endpoint via <strong>GET</strong>.</p>
            </div>
          </TabsContent>

          {/* General tab — name, firmware, location */}
          <TabsContent value="general" className="space-y-5 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Charger name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Location / label</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Garage, Bay 3" maxLength={100} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Firmware / protocol</Label>
              <Select value={firmwareType} onValueChange={setFirmwareType}>
                <SelectTrigger className="sm:w-1/2">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {FIRMWARE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="active:scale-[0.97] transition-transform">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save changes
            </Button>
          </TabsContent>

          {/* Danger zone */}
          <TabsContent value="danger" className="space-y-5 mt-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-medium">Delete this charger</p>
              </div>
              <p className="text-sm text-muted-foreground">
                This will permanently remove the charger, all its telemetry data, schedules, and session history. This action cannot be undone.
              </p>
              {!showDeleteConfirm ? (
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="active:scale-[0.97] transition-transform">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete charger
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <Button variant="destructive" onClick={handleDelete} className="active:scale-[0.97] transition-transform">
                    Yes, delete permanently
                  </Button>
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

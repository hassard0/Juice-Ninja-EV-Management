import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Settings, Save, Loader2, Trash2, Copy, Check, KeyRound, Wifi, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
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

// Firmware-specific setup guides
function getFirmwareGuide(firmware: string | null, webhookUrl: string, commandsUrl: string, deviceId: string, apiKey: string) {
  const truncId = deviceId.slice(0, 8) + "...";
  const truncKey = apiKey.slice(0, 12) + "...";

  switch (firmware) {
    case "openevse":
      return {
        title: "OpenEVSE WiFi Module (ESP32)",
        description: "OpenEVSE has a built-in Emoncms data logging service that can POST charger status to a remote server. Juice Ninja can receive this data by acting as your Emoncms endpoint.",
        steps: [
          {
            where: "WiFi Web UI → Services → Emoncms",
            instructions: [
              "Connect to your OpenEVSE WiFi module's web interface (usually http://openevse.local or the charger's IP address).",
              "Navigate to the Services page.",
              "Under Emoncms Data Logging, enable the service.",
              `Set the Emoncms server URL to:\n  ${webhookUrl}`,
              `Set the Emoncms API key (node field) to:\n  ${apiKey}`,
              `Set the Emoncms Node name to your Device ID:\n  ${deviceId}`,
              "The OpenEVSE will POST status data (amps, voltage, temperature, energy) every 30 seconds.",
              "You can toggle between HTTP and HTTPS — use HTTPS for secure transmission.",
            ],
          },
          {
            where: "WiFi Web UI → Services → MQTT (alternative)",
            instructions: [
              "If you use an MQTT broker (e.g. Mosquitto on a Raspberry Pi), you can bridge MQTT data to Juice Ninja instead.",
              "Navigate to Services → MQTT in the OpenEVSE web UI.",
              "Enter your MQTT broker details (host, port, username, password).",
              `Set the base topic (e.g. openevse).`,
              "OpenEVSE will publish status data to topics like openevse/amp, openevse/voltage, openevse/temp, openevse/wh.",
              "You'll need a small bridge script on your broker to forward these to the Juice Ninja telemetry webhook.",
            ],
          },
          {
            where: "WiFi Web UI → Charger controls via HTTP API",
            instructions: [
              "OpenEVSE exposes a local HTTP API for control. Juice Ninja can send commands to it if your charger is on the same network.",
              "Start/stop charging: POST to http://{openevse_ip}/claims/client/65537 with JSON body {\"state\": \"active\"} or {\"state\": \"disabled\"}.",
              "Set current: POST to http://{openevse_ip}/claims/client/65537 with JSON body {\"state\": \"active\", \"charge_current\": 16}.",
              "Get live status: GET http://{openevse_ip}/status returns JSON with amp, voltage, temp1, watthour, etc.",
              "If HTTP Authentication is enabled on the OpenEVSE (recommended), include Basic Auth credentials with each request.",
            ],
          },
        ],
        docsUrl: "https://openevse.stoplight.io/docs/openevse-wifi-v4",
      };

    case "ocpp":
      return {
        title: "OCPP 1.6J Central System",
        description: "OCPP uses a single persistent WebSocket connection between charger and Central System. All communication — telemetry (MeterValues), status updates (StatusNotification), and remote control (RemoteStartTransaction, RemoteStopTransaction) — flows over this one connection.",
        steps: [
          {
            where: "Charger configuration panel → OCPP Settings",
            instructions: [
              "Access your charger's configuration interface (varies by manufacturer — check your manual for the admin panel URL or app).",
              "Find the OCPP settings section (sometimes labelled Network, Cloud, Backend, or Central System).",
              "Set the OCPP version/protocol to 1.6J (JSON over WebSocket).",
              `Set the Central System URL (CSMS URL / WebSocket URL) to:\n  ws://${webhookUrl.replace(/^https?:\/\//, "")}/${deviceId}`,
              "Note: this is a single WebSocket endpoint — the charger handles telemetry reporting AND receives commands over the same connection.",
              `Set the Charge Point ID (Station Identity) to:\n  ${deviceId}`,
              `If your charger supports a CSMS password or authentication key, set it to:\n  ${truncKey}`,
              "Configure MeterValues interval to 30 seconds with measurands: Energy.Active.Import.Register, Current.Import, Voltage, Temperature.",
              "Set Heartbeat Interval to 60 seconds.",
              "Save and restart. The charger will open a WebSocket to Juice Ninja and begin sending BootNotification, then periodic Heartbeat and MeterValues messages. Remote start/stop commands are sent back over the same connection.",
            ],
          },
        ],
        docsUrl: "https://www.openchargealliance.org/protocols/ocpp-16/",
      };

    case "wallbox":
      return {
        title: "Wallbox (Pulsar Plus / Commander / Copper)",
        description: "Wallbox chargers support OCPP 1.6J. Configure the connection through the myWallbox app or portal.",
        steps: [
          {
            where: "myWallbox App → Charger settings → OCPP",
            instructions: [
              "Open the myWallbox app (iOS/Android) or portal (my.wallbox.com).",
              "Select your charger and go to Settings.",
              "Scroll to OCPP and enable it.",
              `Set the CSMS URL to:\n  ${webhookUrl}`,
              `Set the Charge Point ID to:\n  ${deviceId}`,
              "If your charger/plan supports OCPP password authentication, enter your API key.",
              "Tap Save. The charger will restart and connect to Juice Ninja.",
              "An OCPP icon should appear on the charger's app overview when connected.",
            ],
          },
          {
            where: "Wallbox portal → Advanced settings",
            instructions: [
              "Alternatively, log into my.wallbox.com.",
              "Go to your charger → Configuration → OCPP.",
              "If your OCPP provider isn't listed in the dropdown, select 'Other' and enter the URL manually.",
              "The configuration fields are the same as in the app.",
            ],
          },
        ],
        docsUrl: "https://support.wallbox.com/na/knowledge-base/ocpp-activation-and-setup-guide/",
      };

    case "zappi":
      return {
        title: "myenergi Zappi",
        description: "The Zappi uses myenergi's cloud API. Juice Ninja connects via the myenergi API — you'll need your myenergi Hub serial number and API key from the myenergi app.",
        steps: [
          {
            where: "myenergi App → Settings → API access",
            instructions: [
              "Open the myenergi app on your phone.",
              "Go to Settings → API access or Hub settings.",
              "Note your Hub serial number and generate an API key if you haven't already.",
              "You don't configure the Zappi itself to connect to Juice Ninja — instead, Juice Ninja polls the myenergi cloud API on your behalf.",
              `Enter your myenergi Hub serial and API key into Juice Ninja's charger settings (General tab) so we can fetch your Zappi's data.`,
            ],
          },
          {
            where: "Juice Ninja setup",
            instructions: [
              `Your Juice Ninja Device ID is: ${deviceId}`,
              `Your Juice Ninja API Key is: ${truncKey}`,
              "These are used internally — you don't need to enter them into the Zappi.",
              "Instead, ensure your myenergi Hub is online and the Zappi is connected to it.",
            ],
          },
        ],
        docsUrl: "https://myenergi.info/",
      };

    case "grizzl-e":
      return {
        title: "Grizzl-E Smart",
        description: "Grizzl-E Smart chargers support OCPP 1.6J via the Grizzl-E Connect app.",
        steps: [
          {
            where: "Grizzl-E Connect App → Settings → OCPP",
            instructions: [
              "Open the Grizzl-E Connect app.",
              "Select your charger and navigate to Settings → OCPP.",
              "Enable OCPP.",
              `Set the Backend URL to:\n  ${webhookUrl}`,
              `Set the Charge Point Identity to:\n  ${deviceId}`,
              "Save the settings. The charger will connect to Juice Ninja on the next boot cycle.",
            ],
          },
        ],
        docsUrl: null,
      };

    case "emporia":
      return {
        title: "Emporia EV Charger",
        description: "Emporia chargers are managed through the Emporia Vue app. Integration with Juice Ninja uses the Emporia cloud API.",
        steps: [
          {
            where: "Emporia Vue App → Settings",
            instructions: [
              "Emporia chargers don't support direct OCPP configuration.",
              "Integration works through the Emporia cloud API.",
              "Ensure your charger is set up and online in the Emporia Vue app.",
              "Juice Ninja will poll the Emporia API for telemetry data.",
              "You may need to provide your Emporia account credentials in the General settings tab.",
            ],
          },
        ],
        docsUrl: null,
      };

    case "custom_http":
      return {
        title: "Custom HTTP Integration",
        description: "For chargers with custom firmware or DIY setups, configure your device to POST JSON telemetry to Juice Ninja's webhook.",
        steps: [
          {
            where: "Your charger's firmware / script configuration",
            instructions: [
              `Configure your device to send HTTP POST requests to:\n  ${webhookUrl}`,
              `Include these headers with every request:\n  x-device-id: ${deviceId}\n  x-api-key: ${apiKey}\n  Content-Type: application/json`,
              `Send a JSON body with any of these fields:\n  {\n    "amps": 16.2,\n    "voltage": 238,\n    "wh": 1450,\n    "temperature": 32.5\n  }`,
              "All fields are optional — send whatever your hardware can measure.",
              `To receive commands, poll:\n  GET ${commandsUrl}\n  with the same x-device-id and x-api-key headers.`,
              "Pending commands are also returned in the telemetry POST response body for convenience.",
              "Recommended polling/POST interval: every 10–30 seconds while charging, every 60 seconds when idle.",
            ],
          },
        ],
        docsUrl: null,
      };

    default:
      return {
        title: "Generic Charger Setup",
        description: "Configure your charger to send telemetry data to Juice Ninja using HTTP POST requests.",
        steps: [
          {
            where: "Charger configuration interface",
            instructions: [
              `Set the backend/webhook URL to:\n  ${webhookUrl}`,
              `Set the device identifier to:\n  ${deviceId}`,
              `Set the authentication key to:\n  ${apiKey}`,
              "If your charger supports OCPP 1.6, use the OCPP configuration path instead.",
              "If it supports HTTP webhooks, configure it to POST JSON telemetry data.",
              "Refer to your charger's manual for the exact settings location.",
            ],
          },
        ],
        docsUrl: null,
      };
  }
}

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

  const guide = getFirmwareGuide(device.firmware_type, webhookUrl, commandsUrl, device.id, device.api_key || "");

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
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
            <TabsTrigger value="setup" className="flex-1">Setup guide</TabsTrigger>
            <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="danger" className="flex-1">Danger</TabsTrigger>
          </TabsList>

          {/* Connection tab — credentials */}
          <TabsContent value="connection" className="space-y-5 mt-4">
            <p className="text-sm text-muted-foreground">
              These are the credentials your charger needs to connect to Juice Ninja. See the <strong>Setup guide</strong> tab for where to enter them.
            </p>

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
          </TabsContent>

          {/* Setup guide tab — firmware-specific instructions */}
          <TabsContent value="setup" className="space-y-5 mt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{guide.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{guide.description}</p>
              </div>
              {guide.docsUrl && (
                <a href={guide.docsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Docs
                  </Button>
                </a>
              )}
            </div>

            <Accordion type="multiple" defaultValue={["step-0"]} className="space-y-2">
              {guide.steps.map((step, idx) => (
                <AccordionItem key={idx} value={`step-${idx}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      {step.where}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <ol className="space-y-3 list-none">
                      {step.instructions.map((instruction, i) => (
                        <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                          <span className="shrink-0 text-xs font-medium text-foreground/50 tabular-nums mt-0.5 w-4 text-right">{i + 1}.</span>
                          <span className="whitespace-pre-wrap break-all">{instruction}</span>
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {device.firmware_type === "custom_http" || device.firmware_type === "other" || !device.firmware_type ? (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium">Example HTTP request</p>
                <code className="block rounded-md border bg-background p-3 text-xs font-mono whitespace-pre text-muted-foreground">
{`POST ${webhookUrl}
x-device-id: ${device.id}
x-api-key: ${(device.api_key || "your-api-key")}
Content-Type: application/json

{
  "amps": 16.2,
  "voltage": 238,
  "wh": 1450,
  "temperature": 32.5
}`}
                </code>
              </div>
            ) : null}
          </TabsContent>

          {/* General tab */}
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

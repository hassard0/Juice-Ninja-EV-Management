import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Copy, Check, KeyRound, Wifi, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";

interface AddChargerDialogProps {
  onAdded: () => void;
}

function generateApiKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "jn_";
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

type Step = "details" | "credentials";

export default function AddChargerDialog({ onAdded }: AddChargerDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [name, setName] = useState("");
  const [firmwareType, setFirmwareType] = useState("");
  const [location, setLocation] = useState("");
  const [maxCurrent, setMaxCurrent] = useState("32");
  const [phases, setPhases] = useState("1");
  const [notes, setNotes] = useState("");

  // Step 2 — generated after creation
  const [createdDeviceId, setCreatedDeviceId] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/telemetry-webhook`;
  const commandsUrl = `https://${projectId}.supabase.co/functions/v1/device-commands`;

  const resetForm = useCallback(() => {
    setStep("details");
    setName("");
    setFirmwareType("");
    setLocation("");
    setMaxCurrent("32");
    setPhases("1");
    setNotes("");
    setCreatedDeviceId("");
    setGeneratedKey("");
    setCopiedField(null);
  }, []);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      toast.error("Name is required and must be under 100 characters");
      return;
    }

    setLoading(true);
    const apiKey = generateApiKey();

    try {
      const { data, error } = await supabase.from("devices").insert({
        user_id: user.id,
        name: trimmedName,
        api_key: apiKey,
        firmware_type: firmwareType || null,
        url: location.trim() || null,
      }).select("id").single();

      if (error) throw error;

      setCreatedDeviceId(data.id);
      setGeneratedKey(apiKey);
      setStep("credentials");
      // Don't call onAdded yet — wait until user clicks Done
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="active:scale-[0.97] transition-transform">
          <Plus className="h-4 w-4 mr-1" /> Add charger
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        {step === "details" ? (
          <>
            <DialogHeader>
              <DialogTitle>Register a new charger</DialogTitle>
              <DialogDescription>
                Configure your charger's details. After registration you'll receive connection credentials to enter into your charger's firmware settings.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-3">
              <div className="space-y-2">
                <Label htmlFor="charger-name">Charger name *</Label>
                <Input
                  id="charger-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Garage Charger, Driveway Unit"
                  required
                  maxLength={100}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Firmware / protocol *</Label>
                  <Select value={firmwareType} onValueChange={setFirmwareType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openevse">OpenEVSE</SelectItem>
                      <SelectItem value="ocpp">OCPP 1.6</SelectItem>
                      <SelectItem value="wallbox">Wallbox</SelectItem>
                      <SelectItem value="zappi">myenergi Zappi</SelectItem>
                      <SelectItem value="grizzl-e">Grizzl-E</SelectItem>
                      <SelectItem value="emporia">Emporia</SelectItem>
                      <SelectItem value="custom_http">Custom HTTP</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="charger-location">Location / label</Label>
                  <Input
                    id="charger-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Home, Office Bay 3"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max current (A)</Label>
                  <Select value={maxCurrent} onValueChange={setMaxCurrent}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 A</SelectItem>
                      <SelectItem value="10">10 A</SelectItem>
                      <SelectItem value="13">13 A</SelectItem>
                      <SelectItem value="16">16 A</SelectItem>
                      <SelectItem value="24">24 A</SelectItem>
                      <SelectItem value="32">32 A</SelectItem>
                      <SelectItem value="40">40 A</SelectItem>
                      <SelectItem value="48">48 A</SelectItem>
                      <SelectItem value="63">63 A</SelectItem>
                      <SelectItem value="80">80 A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phases</Label>
                  <Select value={phases} onValueChange={setPhases}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Single phase</SelectItem>
                      <SelectItem value="3">Three phase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="charger-notes">Notes</Label>
                <Input
                  id="charger-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about this charger"
                  maxLength={500}
                />
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex gap-2.5 items-start text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>After registration, you'll get a webhook URL and API key. Configure these in your charger's firmware so it can send telemetry to Juice Ninja and receive commands.</span>
              </div>

              <Button type="submit" className="w-full active:scale-[0.97] transition-transform" disabled={loading || !firmwareType}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register charger
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Charger registered
              </DialogTitle>
              <DialogDescription>
                Configure your charger with these credentials. The API key is shown only once — copy it now.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 mt-3">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" /> API Key
                  </Label>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono break-all select-all">
                      {generatedKey}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(generatedKey, "key")}
                      className="shrink-0"
                    >
                      {copiedField === "key" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Wifi className="h-3.5 w-3.5" /> Device ID
                  </Label>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono break-all select-all">
                      {createdDeviceId}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(createdDeviceId, "id")}
                      className="shrink-0"
                    >
                      {copiedField === "id" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Telemetry endpoint</Label>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-md border bg-background px-3 py-2 text-xs font-mono break-all select-all">
                      {webhookUrl}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(webhookUrl, "webhook")}
                      className="shrink-0"
                    >
                      {copiedField === "webhook" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Commands endpoint</Label>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-md border bg-background px-3 py-2 text-xs font-mono break-all select-all">
                      {commandsUrl}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(commandsUrl, "commands")}
                      className="shrink-0"
                    >
                      {copiedField === "commands" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium">Charger configuration</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In your charger's firmware settings, configure it to <strong>POST</strong> telemetry data to the telemetry endpoint above with these headers:
                </p>
                <code className="block rounded-md border bg-background p-3 text-xs font-mono whitespace-pre text-muted-foreground">
{`x-device-id: ${createdDeviceId.slice(0, 8)}...
x-api-key: ${generatedKey.slice(0, 12)}...
Content-Type: application/json

{
  "amps": 16.2,
  "voltage": 238,
  "wh": 1450,
  "temperature": 32.5
}`}
                </code>
                <p className="text-xs text-muted-foreground">
                  Pending commands are returned in the response body, or poll the commands endpoint via <strong>GET</strong>.
                </p>
              </div>

              <Button className="w-full active:scale-[0.97] transition-transform" onClick={() => handleClose(false)}>
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

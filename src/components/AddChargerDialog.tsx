import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddChargerDialogProps {
  onAdded: () => void;
}

export default function AddChargerDialog({ onAdded }: AddChargerDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [firmwareType, setFirmwareType] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("devices").insert({
        user_id: user.id,
        name: name.trim(),
        url: url.trim() || null,
        api_key: apiKey.trim() || null,
        firmware_type: firmwareType || null,
      });
      if (error) throw error;
      toast.success(`${name} registered successfully`);
      setOpen(false);
      setName("");
      setUrl("");
      setApiKey("");
      setFirmwareType("");
      onAdded();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="active:scale-[0.97] transition-transform">
          <Plus className="h-4 w-4 mr-1" /> Add charger
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register a new charger</DialogTitle>
          <DialogDescription>Add your EV charger details to start monitoring and controlling it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="charger-name">Charger name *</Label>
            <Input id="charger-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Garage Charger" required maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="charger-url">IP address or URL</Label>
            <Input id="charger-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="192.168.1.100 or https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="charger-apikey">API key</Label>
            <Input id="charger-apikey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Optional API key for charger access" />
          </div>
          <div className="space-y-2">
            <Label>Firmware type</Label>
            <Select value={firmwareType} onValueChange={setFirmwareType}>
              <SelectTrigger>
                <SelectValue placeholder="Select firmware" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openevse">OpenEVSE</SelectItem>
                <SelectItem value="ocpp">OCPP 1.6</SelectItem>
                <SelectItem value="wallbox">Wallbox</SelectItem>
                <SelectItem value="zappi">myenergi Zappi</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full active:scale-[0.97] transition-transform" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register charger
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

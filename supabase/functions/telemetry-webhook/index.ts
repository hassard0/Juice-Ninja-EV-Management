import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-device-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Charger authenticates with its device ID + API key
    const deviceId = req.headers.get("x-device-id");
    const apiKey = req.headers.get("x-api-key");

    if (!deviceId || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-device-id or x-api-key header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify device exists and API key matches
    const { data: device, error: devErr } = await supabase
      .from("devices")
      .select("id, api_key")
      .eq("id", deviceId)
      .single();

    if (devErr || !device || device.api_key !== apiKey) {
      return new Response(JSON.stringify({ error: "Invalid device credentials" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    // Expected body: { amps, voltage, wh, temperature } or array of readings
    const readings = Array.isArray(body) ? body : [body];

    const rows = readings.map((r: any) => ({
      device_id: deviceId,
      amps: r.amps ?? null,
      voltage: r.voltage ?? null,
      wh: r.wh ?? null,
      temperature: r.temperature ?? r.temp ?? null,
      recorded_at: r.recorded_at ?? new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase.from("telemetry").insert(rows);
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return any pending commands for this device
    const { data: commands } = await supabase
      .from("device_commands")
      .select("*")
      .eq("device_id", deviceId)
      .eq("status", "pending")
      .order("created_at");

    // Mark returned commands as acknowledged
    if (commands && commands.length > 0) {
      const ids = commands.map((c: any) => c.id);
      await supabase
        .from("device_commands")
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
        .in("id", ids);
    }

    return new Response(JSON.stringify({
      ok: true,
      inserted: rows.length,
      commands: commands || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

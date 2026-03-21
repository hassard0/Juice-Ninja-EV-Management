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

    const deviceId = req.headers.get("x-device-id");
    const apiKey = req.headers.get("x-api-key");

    if (!deviceId || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-device-id or x-api-key header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify device
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

    if (req.method === "GET") {
      // Charger polls for pending commands
      const { data: commands } = await supabase
        .from("device_commands")
        .select("*")
        .eq("device_id", deviceId)
        .eq("status", "pending")
        .order("created_at");

      if (commands && commands.length > 0) {
        const ids = commands.map((c: any) => c.id);
        await supabase
          .from("device_commands")
          .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
          .in("id", ids);
      }

      return new Response(JSON.stringify({ commands: commands || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      // Charger reports command result
      const { command_id, status, result } = await req.json();
      if (!command_id) {
        return new Response(JSON.stringify({ error: "Missing command_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("device_commands")
        .update({
          status: status || "completed",
          completed_at: new Date().toISOString(),
          result: result || null,
        })
        .eq("id", command_id)
        .eq("device_id", deviceId);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${CF_API}${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) throw new Error(`CF API error: ${JSON.stringify(data.errors)}`);
  return data;
}

// The API proxy worker script
const API_PROXY_SCRIPT = `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const SUPABASE_URL = 'SUPABASE_URL_PLACEHOLDER';

async function handleRequest(request) {
  const url = new URL(request.url);

  // Map /functions/v1/* to Supabase edge functions
  // Map /rest/v1/* to Supabase REST API
  // Map /auth/v1/* to Supabase Auth
  // Map /storage/v1/* to Supabase Storage
  const targetUrl = SUPABASE_URL + url.pathname + url.search;

  const headers = new Headers(request.headers);
  headers.set('Host', new URL(SUPABASE_URL).host);

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  const respHeaders = new Headers(response.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type, x-api-key, x-device-id');
  respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: respHeaders });
  }

  return new Response(response.body, {
    status: response.status,
    headers: respHeaders,
  });
}
`;

// The OCPP WebSocket bridge worker script
const OCPP_BRIDGE_SCRIPT = `
const SUPABASE_URL = 'SUPABASE_URL_PLACEHOLDER';
const SERVICE_KEY = 'SERVICE_KEY_PLACEHOLDER';

addEventListener('fetch', event => {
  if (event.request.headers.get('Upgrade') === 'websocket') {
    event.respondWith(handleWebSocket(event.request));
  } else {
    event.respondWith(new Response('OCPP WebSocket endpoint. Connect via ws://', { status: 200 }));
  }
});

async function handleWebSocket(request) {
  const url = new URL(request.url);
  // Extract device ID from path: /ocpp/<device-id> or /<device-id>
  const pathParts = url.pathname.split('/').filter(Boolean);
  const deviceId = pathParts[pathParts.length - 1];

  if (!deviceId) {
    return new Response('Missing device ID in path', { status: 400 });
  }

  const [client, server] = Object.values(new WebSocketPair());

  server.accept();

  // Verify device exists
  const verifyRes = await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + deviceId + '&select=id,api_key', {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
    },
  });
  const devices = await verifyRes.json();
  if (!devices || devices.length === 0) {
    server.close(4001, 'Unknown device');
    return new Response(null, { status: 101, webSocket: client });
  }

  const device = devices[0];

  server.addEventListener('message', async (event) => {
    try {
      const msg = JSON.parse(event.data);
      // OCPP 1.6J message format: [MessageTypeId, UniqueId, Action, Payload]
      // or [MessageTypeId, UniqueId, Payload] for responses
      if (!Array.isArray(msg) || msg.length < 3) {
        server.send(JSON.stringify([4, '', 'FormationViolation', 'Invalid OCPP message format', {}]));
        return;
      }

      const messageType = msg[0];
      const uniqueId = msg[1];
      const action = msg[2];
      const payload = msg[3] || {};

      if (messageType === 2) {
        // CALL from charger
        await handleOcppCall(server, deviceId, device.api_key, uniqueId, action, payload);
      } else if (messageType === 3) {
        // CALLRESULT - charger responding to our command
        console.log('CALLRESULT from ' + deviceId + ':', JSON.stringify(msg));
      } else if (messageType === 4) {
        // CALLERROR
        console.log('CALLERROR from ' + deviceId + ':', JSON.stringify(msg));
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  // Poll for pending commands every 10 seconds
  const commandPollInterval = setInterval(async () => {
    try {
      const cmdRes = await fetch(SUPABASE_URL + '/rest/v1/device_commands?device_id=eq.' + deviceId + '&status=eq.pending&order=created_at', {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
        },
      });
      const commands = await cmdRes.json();
      for (const cmd of (commands || [])) {
        const ocppMsg = mapCommandToOcpp(cmd);
        if (ocppMsg) {
          server.send(JSON.stringify(ocppMsg));
          // Mark acknowledged
          await fetch(SUPABASE_URL + '/rest/v1/device_commands?id=eq.' + cmd.id, {
            method: 'PATCH',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': 'Bearer ' + SERVICE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ status: 'acknowledged', acknowledged_at: new Date().toISOString() }),
          });
        }
      }
    } catch (e) {
      console.error('Command poll error:', e);
    }
  }, 10000);

  server.addEventListener('close', () => {
    clearInterval(commandPollInterval);
  });

  return new Response(null, { status: 101, webSocket: client });
}

function mapCommandToOcpp(cmd) {
  const uid = cmd.id.substring(0, 8);
  switch (cmd.command) {
    case 'start':
      return [2, uid, 'RemoteStartTransaction', { connectorId: 1, idTag: 'juiceninja' }];
    case 'stop':
      return [2, uid, 'RemoteStopTransaction', { transactionId: 0 }];
    case 'set_current':
      const limit = cmd.payload?.amps || 32;
      return [2, uid, 'SetChargingProfile', {
        connectorId: 1,
        csChargingProfiles: {
          chargingProfileId: 1,
          stackLevel: 0,
          chargingProfilePurpose: 'TxDefaultProfile',
          chargingProfileKind: 'Absolute',
          chargingSchedule: {
            chargingRateUnit: 'A',
            chargingSchedulePeriod: [{ startPeriod: 0, limit }],
          },
        },
      }];
    default:
      return null;
  }
}

async function handleOcppCall(server, deviceId, apiKey, uniqueId, action, payload) {
  switch (action) {
    case 'BootNotification':
      server.send(JSON.stringify([3, uniqueId, {
        status: 'Accepted',
        currentTime: new Date().toISOString(),
        interval: 60,
      }]));
      break;

    case 'Heartbeat':
      server.send(JSON.stringify([3, uniqueId, { currentTime: new Date().toISOString() }]));
      break;

    case 'StatusNotification':
      server.send(JSON.stringify([3, uniqueId, {}]));
      break;

    case 'MeterValues':
      // Extract telemetry from OCPP MeterValues
      const telemetry = { device_id: deviceId };
      const sampledValues = payload.meterValue?.[0]?.sampledValue || [];
      for (const sv of sampledValues) {
        const val = parseFloat(sv.value);
        if (sv.measurand === 'Current.Import') telemetry.amps = val;
        else if (sv.measurand === 'Voltage') telemetry.voltage = val;
        else if (sv.measurand === 'Energy.Active.Import.Register') telemetry.wh = val;
        else if (sv.measurand === 'Temperature') telemetry.temperature = val;
      }

      // Forward to telemetry table
      await fetch(SUPABASE_URL + '/rest/v1/telemetry', {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(telemetry),
      });

      server.send(JSON.stringify([3, uniqueId, {}]));
      break;

    case 'StartTransaction':
      server.send(JSON.stringify([3, uniqueId, { transactionId: Date.now(), idTagInfo: { status: 'Accepted' } }]));
      break;

    case 'StopTransaction':
      server.send(JSON.stringify([3, uniqueId, { idTagInfo: { status: 'Accepted' } }]));
      break;

    case 'Authorize':
      server.send(JSON.stringify([3, uniqueId, { idTagInfo: { status: 'Accepted' } }]));
      break;

    default:
      // Accept unknown actions gracefully
      server.send(JSON.stringify([3, uniqueId, {}]));
      break;
  }
}
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!token || !accountId) {
      return new Response(JSON.stringify({ error: "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action || "status";
    const results: Record<string, any> = {};

    // Step 1: Find zone
    const zoneData = await cfFetch("/zones?name=juice.ninja", token);
    if (!zoneData.result || zoneData.result.length === 0) {
      return new Response(JSON.stringify({ error: "juice.ninja zone not found in Cloudflare" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const zoneId = zoneData.result[0].id;
    results.zone_id = zoneId;

    if (action === "status") {
      return new Response(JSON.stringify({ ok: true, zone_id: zoneId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deploy") {
      // Deploy API proxy worker
      const apiScript = API_PROXY_SCRIPT.replace(/SUPABASE_URL_PLACEHOLDER/g, supabaseUrl);
      
      // Upload API proxy worker using the Workers API (form data)
      const apiFormData = new FormData();
      apiFormData.append("metadata", JSON.stringify({
        main_module: "worker.js",
        bindings: [],
      }));
      apiFormData.append("worker.js", new Blob([apiScript], { type: "application/javascript+module" }), "worker.js");
      
      // Use the simpler script upload API
      const apiWorkerRes = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/juice-ninja-api-proxy`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` },
        body: apiScript,
      });
      const apiWorkerData = await apiWorkerRes.json();
      results.api_worker = apiWorkerData.success ? "deployed" : apiWorkerData.errors;

      // Deploy OCPP bridge worker
      const ocppScript = OCPP_BRIDGE_SCRIPT
        .replace(/SUPABASE_URL_PLACEHOLDER/g, supabaseUrl)
        .replace(/SERVICE_KEY_PLACEHOLDER/g, serviceKey);

      const ocppWorkerRes = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/juice-ninja-ocpp-bridge`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` },
        body: ocppScript,
      });
      const ocppWorkerData = await ocppWorkerRes.json();
      results.ocpp_worker = ocppWorkerData.success ? "deployed" : ocppWorkerData.errors;

      // Create DNS records for api.juice.ninja and ocpp.juice.ninja
      for (const sub of ["api", "ocpp"]) {
        // Check if record already exists
        const existing = await cfFetch(`/zones/${zoneId}/dns_records?type=AAAA&name=${sub}.juice.ninja`, token);
        if (existing.result && existing.result.length > 0) {
          results[`dns_${sub}`] = "already exists";
          continue;
        }

        try {
          // Proxied AAAA record (Cloudflare Workers use proxied records)
          await cfFetch(`/zones/${zoneId}/dns_records`, token, {
            method: "POST",
            body: JSON.stringify({
              type: "AAAA",
              name: sub,
              content: "100::",
              proxied: true,
              ttl: 1,
            }),
          });
          results[`dns_${sub}`] = "created";
        } catch (e) {
          results[`dns_${sub}`] = `error: ${e.message}`;
        }
      }

      // Create worker routes
      for (const [sub, workerName] of [["api", "juice-ninja-api-proxy"], ["ocpp", "juice-ninja-ocpp-bridge"]]) {
        try {
          // Check existing routes
          const routesData = await cfFetch(`/zones/${zoneId}/workers/routes`, token);
          const pattern = `${sub}.juice.ninja/*`;
          const existingRoute = routesData.result?.find((r: any) => r.pattern === pattern);
          
          if (existingRoute) {
            results[`route_${sub}`] = "already exists";
            continue;
          }

          await cfFetch(`/zones/${zoneId}/workers/routes`, token, {
            method: "POST",
            body: JSON.stringify({
              pattern,
              script: workerName,
            }),
          });
          results[`route_${sub}`] = "created";
        } catch (e) {
          results[`route_${sub}`] = `error: ${e.message}`;
        }
      }

      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

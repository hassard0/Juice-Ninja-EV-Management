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

  // Accept both /<device-id> and /<prefix>/<device-id> patterns from different firmware styles
  const rawParts = url.pathname.split('/').filter(Boolean);
  const decodedParts = rawParts
    .map((p) => {
      try {
        return decodeURIComponent(p).trim();
      } catch {
        return p.trim();
      }
    })
    .filter(Boolean);

  if (decodedParts.length === 0) {
    return new Response('Missing device ID in path. Use wss://ocpp.juice.ninja/<device-id>', { status: 400 });
  }

  // Prefer the last path segment first, then try earlier segments as fallback
  const orderedCandidates = [
    decodedParts[decodedParts.length - 1],
    ...decodedParts.slice(0, -1).reverse(),
  ].filter((v, i, a) => a.indexOf(v) === i);

  // OCPP chargers often require explicit subprotocol negotiation
  const requestedProtocols = (request.headers.get('Sec-WebSocket-Protocol') || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const selectedProtocol = requestedProtocols.find((p) => {
    const v = p.toLowerCase();
    return v === 'ocpp1.6' || v === 'ocpp1.6j' || v === 'ocpp2.0.1';
  }) || requestedProtocols[0] || null;

  // Verify device exists before accepting the socket
  let resolvedDeviceId = null;
  let device = null;

  for (const candidate of orderedCandidates) {
    const verifyRes = await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + encodeURIComponent(candidate) + '&select=id,api_key', {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
      },
    });

    if (!verifyRes.ok) {
      return new Response('Failed to validate device', { status: 502 });
    }

    const devices = await verifyRes.json();
    if (devices && devices.length > 0) {
      resolvedDeviceId = devices[0].id;
      device = devices[0];
      break;
    }
  }

  if (!resolvedDeviceId || !device) {
    return new Response('Unknown device ID', { status: 403 });
  }

  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  server.addEventListener('message', async (event) => {
    try {
      const raw = event.data;
      const text = typeof raw === 'string'
        ? raw
        : raw instanceof Blob
          ? await raw.text()
          : raw instanceof ArrayBuffer
            ? new TextDecoder().decode(raw)
            : ArrayBuffer.isView(raw)
              ? new TextDecoder().decode(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
              : String(raw);
      const msg = JSON.parse(text.trim());

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
        await handleOcppCall(server, resolvedDeviceId, device.api_key, uniqueId, action, payload);
      } else if (messageType === 3) {
        // CALLRESULT - charger responding to our command
        console.log('CALLRESULT from ' + resolvedDeviceId + ':', JSON.stringify(msg));
      } else if (messageType === 4) {
        // CALLERROR
        console.log('CALLERROR from ' + resolvedDeviceId + ':', JSON.stringify(msg));
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  // Poll for pending commands every 10 seconds, keep device alive,
  // and request fresh telemetry when a vehicle is connected.
  // We intentionally avoid synthetic TriggerMessage(Heartbeat) pings because
  // some firmware rejects unsolicited OCPP calls and drops the socket.
  const commandPollInterval = setInterval(async () => {
    try {
      // Update device timestamp to keep it "online" even between charger heartbeats
      await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + resolvedDeviceId, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });

      const devRes = await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + resolvedDeviceId + '&select=active_transaction_id', {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
        },
      });
      const devData = await devRes.json();
      const dev = devData && devData[0];

      const cmdRes = await fetch(SUPABASE_URL + '/rest/v1/device_commands?device_id=eq.' + resolvedDeviceId + '&status=eq.pending&order=created_at', {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
        },
      });
      const commands = await cmdRes.json();
      for (const cmd of (commands || [])) {
        const ocppMsg = mapCommandToOcpp(cmd, dev?.active_transaction_id);
        if (!ocppMsg) {
          await fetch(SUPABASE_URL + '/rest/v1/device_commands?id=eq.' + cmd.id, {
            method: 'PATCH',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': 'Bearer ' + SERVICE_KEY,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              status: 'failed',
              completed_at: new Date().toISOString(),
              result: { error: 'Unable to build OCPP command payload' },
            }),
          });
          continue;
        }

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
    } catch (e) {
      console.error('Command poll error:', e);
    }
  }, 10000);

  server.addEventListener('close', () => {
    clearInterval(commandPollInterval);
  });

  server.addEventListener('error', () => {
    clearInterval(commandPollInterval);
  });

  const responseHeaders = selectedProtocol ? { 'Sec-WebSocket-Protocol': selectedProtocol } : undefined;
  return new Response(null, { status: 101, webSocket: client, headers: responseHeaders });
}

// Track active transaction IDs per device in-memory for low-latency lookup
const activeTransactions = {};

function mapCommandToOcpp(cmd, persistedTransactionId = null) {
  const uid = cmd.id.substring(0, 8);
  switch (cmd.command) {
    case 'start':
      return [2, uid, 'RemoteStartTransaction', { connectorId: 1, idTag: 'juiceninja' }];
    case 'stop': {
      const txId = cmd.payload?.transactionId || activeTransactions[cmd.device_id] || persistedTransactionId || null;
      if (txId) {
        return [2, uid, 'RemoteStopTransaction', { transactionId: txId }];
      }
      // Fallback when transactionId is unknown: request a soft reset,
      // which most chargers apply immediately and stops active charging.
      return [2, uid, 'Reset', { type: 'Soft' }];
    }
    case 'set_current': {
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
    }
    default:
      return null;
  }
}

async function handleOcppCall(server, deviceId, apiKey, uniqueId, action, payload) {
  // Update device last-seen timestamp on every OCPP message
  await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + deviceId, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });

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

    case 'StatusNotification': {
      // Track vehicle connection state from connector 1
      const connectorStatus = payload.status;
      const connectorId = payload.connectorId;
      if (connectorId === 1 || connectorId === undefined) {
        // Preparing, Charging, SuspendedEV, SuspendedEVSE, Finishing all indicate vehicle connected
        const vehicleConnected = ['Preparing', 'Charging', 'SuspendedEV', 'SuspendedEVSE', 'Finishing'].includes(connectorStatus);
        const chargingStatus = connectorStatus === 'Charging' ? 'charging'
          : ['SuspendedEV', 'SuspendedEVSE'].includes(connectorStatus) ? 'suspended'
          : ['Preparing', 'Finishing'].includes(connectorStatus) ? 'preparing'
          : connectorStatus === 'Available' ? 'idle'
          : connectorStatus === 'Faulted' ? 'faulted'
          : 'unknown';
        await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + deviceId, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ vehicle_connected: vehicleConnected, charging_status: chargingStatus }),
        });
      }
      server.send(JSON.stringify([3, uniqueId, {}]));
      break;
    }

    case 'MeterValues': {
      // Extract telemetry from OCPP MeterValues
      const telemetry = { device_id: deviceId };
      const sampledValues = payload.meterValue?.[0]?.sampledValue || [];
      let seenTxId = null;
      if (payload && payload.transactionId != null) {
        const parsedTxId = Number(payload.transactionId);
        if (Number.isFinite(parsedTxId) && parsedTxId > 0) {
          seenTxId = Math.trunc(parsedTxId);
        }
      }

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

      // Persist active transaction ID seen in meter stream (important after reconnects)
      if (seenTxId) {
        activeTransactions[deviceId] = seenTxId;
        await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + deviceId, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ active_transaction_id: seenTxId, charging_status: 'charging', vehicle_connected: true }),
        });
      }

      server.send(JSON.stringify([3, uniqueId, {}]));
      break;
    }

    case 'StartTransaction': {
      const txId = Date.now();
      activeTransactions[deviceId] = txId;
      await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + deviceId, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ active_transaction_id: txId, charging_status: 'charging', vehicle_connected: true }),
      });
      server.send(JSON.stringify([3, uniqueId, { transactionId: txId, idTagInfo: { status: 'Accepted' } }]));
      break;
    }

    case 'StopTransaction':
      delete activeTransactions[deviceId];
      await fetch(SUPABASE_URL + '/rest/v1/devices?id=eq.' + deviceId, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ active_transaction_id: null, charging_status: 'idle', vehicle_connected: false }),
      });
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
      
      // Use the simpler script upload API with correct Content-Type
      const apiWorkerRes = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/juice-ninja-api-proxy`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/javascript" },
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
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/javascript" },
        body: ocppScript,
      });
      const ocppWorkerData = await ocppWorkerRes.json();
      results.ocpp_worker = ocppWorkerData.success ? "deployed" : ocppWorkerData.errors;

      // Ensure DNS records for api.juice.ninja and ocpp.juice.ninja are Cloudflare-proxied
      // (users may manually edit DNS and accidentally break worker routing)
      for (const sub of ["api", "ocpp"]) {
        const fqdn = `${sub}.juice.ninja`;
        try {
          const existing = await cfFetch(`/zones/${zoneId}/dns_records?name=${fqdn}`, token);
          const existingAaaa = (existing.result || []).find((r: any) => r.type === "AAAA");

          if (!existingAaaa) {
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
            continue;
          }

          const needsUpdate = existingAaaa.content !== "100::" || existingAaaa.proxied !== true || existingAaaa.ttl !== 1;
          if (!needsUpdate) {
            results[`dns_${sub}`] = "already exists";
            continue;
          }

          await cfFetch(`/zones/${zoneId}/dns_records/${existingAaaa.id}`, token, {
            method: "PATCH",
            body: JSON.stringify({
              type: "AAAA",
              name: sub,
              content: "100::",
              proxied: true,
              ttl: 1,
            }),
          });
          results[`dns_${sub}`] = "updated";
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

    if (action === "fix_ssl") {
      // Check current SSL setting
      const sslData = await cfFetch(`/zones/${zoneId}/settings/ssl`, token);
      results.current_ssl = sslData.result?.value;

      // Set SSL to "flexible" so Cloudflare terminates SSL for clients
      const setSsl = await cfFetch(`/zones/${zoneId}/settings/ssl`, token, {
        method: "PATCH",
        body: JSON.stringify({ value: "flexible" }),
      });
      results.ssl_set = setSsl.success ? "flexible" : setSsl.errors;

      // Also enable Universal SSL
      const univSsl = await cfFetch(`/zones/${zoneId}/ssl/universal/settings`, token, {
        method: "PATCH",
        body: JSON.stringify({ enabled: true }),
      });
      results.universal_ssl = univSsl.success ? "enabled" : univSsl.errors;

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

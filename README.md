# ⚡ Juice Ninja

An open-source EV charger management platform for home and business users. Monitor, schedule, and control your charging hardware from a single dashboard.

## Features

- **Real-time monitoring** — Live telemetry (amps, voltage, temperature, energy) streamed from your charger
- **Remote control** — Start/stop charging and set current limits from anywhere
- **Scheduling** — Create per-device charging schedules with day-of-week and time-window controls
- **Session history** — Track energy consumption and costs over time
- **Tariff management** — Configure time-of-use electricity rates for accurate cost tracking
- **Multi-device support** — Register and manage multiple chargers under one account

## Architecture

### Frontend

React + TypeScript + Vite, styled with Tailwind CSS. State management via TanStack Query with real-time subscriptions for live device status.

### Backend

- **Supabase** — PostgreSQL database with row-level security for multi-tenant data isolation
- **Supabase Auth** — Email-based authentication with protected routes
- **Supabase Edge Functions** (Deno) — Serverless functions for device command proxying and telemetry ingestion

### Cloudflare Workers — OCPP WebSocket Bridge

EV chargers communicate via the **OCPP 1.6J** protocol over persistent WebSocket connections. Since edge functions are stateless and short-lived, a **Cloudflare Worker** acts as a bridge:

1. The charger opens a WebSocket to the Cloudflare Worker
2. The Worker maintains the long-lived connection and translates OCPP frames to HTTPS calls back to the edge functions
3. Commands (Start/Stop) flow from the database → edge function → Worker → charger
4. Telemetry flows from charger → Worker → edge function → database

**Keepalive strategy:**
- 20-second application-level pings to detect dead sockets
- Proactive probe requests (Heartbeat/StatusNotification/MeterValues) after 3 minutes of silence
- Hard reconnect after 12 minutes of total inactivity to work within Cloudflare's idle timeouts
- State persistence via Cloudflare KV to survive bridge restarts

> Requires the **Cloudflare Workers Paid plan** for 30s CPU time and extended WebSocket durations.

## Getting Started

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Set up the Cloudflare Worker bridge (see `supabase/functions/cloudflare-setup/index.ts` for the deployment script)

## Contributing

Contributions are welcome! Here's how to get involved:

1. **Fork** the repository
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feat/my-feature
   ```
3. **Make your changes** — keep commits focused and descriptive
4. **Test locally** — ensure the dev server runs without errors
5. **Open a Pull Request** — describe what you changed and why

### Guidelines

- Follow existing code style (TypeScript strict, Tailwind utility classes)
- Keep components small and focused
- Add meaningful commit messages
- If adding a new feature, update this README if applicable

## License

MIT

---

Made with ❤️ by [hassard0](https://github.com/hassard0)

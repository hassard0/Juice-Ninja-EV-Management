

# Juice Ninja — EV Charger Management Platform (MVP)

## Brand & Design
- **Color palette**: Nature-inspired greens (emerald, sage, forest), warm earthy neutrals, clean white backgrounds
- **Typography**: Modern sans-serif, clean and professional
- **Logo area**: "Juice Ninja" wordmark with a lightning bolt or leaf accent

## Pages & Features

### 1. Landing / Marketing Page
- Hero section with tagline ("Take control of your EV charging")
- Feature highlights (monitor, schedule, control)
- CTA to sign up / log in

### 2. Authentication (Lovable Cloud)
- Email + Google sign-in
- Signup flow with profile creation
- Protected routes for dashboard

### 3. Dashboard (Home)
- Overview cards: total energy today, active sessions, number of chargers
- Live status of each registered charger (state, current amps, kWh delivered)
- Quick actions: start/stop charging

### 4. Device Management
- Register a new charger (name, IP/URL, API key, firmware type)
- Device detail page: connection status, firmware info, configuration
- Edit/remove chargers

### 5. Charger Monitoring & Telemetry
- Real-time status display (amps, voltage, temperature, session kWh)
- Historical usage charts (daily/weekly/monthly energy consumption)
- Session history log

### 6. Scheduling
- Set charging schedules per device (start time, end time, days of week)
- Visual schedule calendar/timeline
- Enable/disable schedules

### 7. Charger Controls
- Start/stop charging remotely
- Set current limit
- Eco/solar divert mode toggle

## Database (Lovable Cloud)
- **profiles**: user info linked to auth
- **devices**: charger registry (name, url, api_key, firmware_type, owner)
- **telemetry**: time-series data (device_id, amps, voltage, wh, temp, timestamp)
- **sessions**: charging sessions (device_id, start, end, energy, cost)
- **schedules**: per-device schedules (device_id, days, start_time, end_time, enabled)

## Edge Functions
- Device status webhook (receive telemetry POSTs from chargers)
- Device control proxy (send commands to charger HTTP API)

## Tech Notes
- Mock telemetry data initially for demo/development (simulated charger data)
- Design DB with `tenant_id` column from day one (default = 1) for future multi-tenant expansion
- Row-level security on all tables


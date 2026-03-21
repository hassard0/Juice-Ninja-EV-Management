export interface MockDevice {
  id: string;
  name: string;
  status: "charging" | "idle" | "offline" | "scheduled";
  amps: number;
  voltage: number;
  power_kw: number;
  session_kwh: number;
  temperature: number;
  firmware: string;
}

export interface MockSession {
  id: string;
  device_name: string;
  start: string;
  end: string | null;
  energy_kwh: number;
  cost: number;
}

export const mockDevices: MockDevice[] = [
  {
    id: "d1",
    name: "Garage Charger",
    status: "charging",
    amps: 28.4,
    voltage: 238,
    power_kw: 6.76,
    session_kwh: 14.3,
    temperature: 37,
    firmware: "v3.2.1",
  },
  {
    id: "d2",
    name: "Driveway Unit",
    status: "idle",
    amps: 0,
    voltage: 240,
    power_kw: 0,
    session_kwh: 0,
    temperature: 22,
    firmware: "v3.2.1",
  },
  {
    id: "d3",
    name: "Office Bay 1",
    status: "scheduled",
    amps: 0,
    voltage: 239,
    power_kw: 0,
    session_kwh: 0,
    temperature: 19,
    firmware: "v3.1.8",
  },
];

export const mockSessions: MockSession[] = [
  { id: "s1", device_name: "Garage Charger", start: "2026-03-21T02:00:00", end: null, energy_kwh: 14.3, cost: 3.58 },
  { id: "s2", device_name: "Garage Charger", start: "2026-03-20T23:00:00", end: "2026-03-21T01:45:00", energy_kwh: 18.7, cost: 4.68 },
  { id: "s3", device_name: "Driveway Unit", start: "2026-03-20T19:30:00", end: "2026-03-20T22:15:00", energy_kwh: 22.1, cost: 5.53 },
  { id: "s4", device_name: "Office Bay 1", start: "2026-03-20T08:00:00", end: "2026-03-20T17:00:00", energy_kwh: 41.2, cost: 10.30 },
  { id: "s5", device_name: "Garage Charger", start: "2026-03-19T23:30:00", end: "2026-03-20T05:00:00", energy_kwh: 35.8, cost: 8.95 },
];

export const mockEnergyData = [
  { day: "Mon", kwh: 28.4 },
  { day: "Tue", kwh: 34.1 },
  { day: "Wed", kwh: 19.7 },
  { day: "Thu", kwh: 42.3 },
  { day: "Fri", kwh: 37.9 },
  { day: "Sat", kwh: 15.2 },
  { day: "Sun", kwh: 22.8 },
];

type DeviceWithUpdatedAt = {
  updated_at: string;
};

// Keep freshness windows tight so UI status reflects real live connectivity.
export const DEVICE_ONLINE_WINDOW_MS = 3 * 60 * 1000;
export const TELEMETRY_FRESH_MS = 3 * 60 * 1000;

export function isDeviceOnline(device: DeviceWithUpdatedAt, now = Date.now()) {
  return now - new Date(device.updated_at).getTime() < DEVICE_ONLINE_WINDOW_MS;
}

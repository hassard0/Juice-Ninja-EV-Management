type DeviceWithUpdatedAt = {
  updated_at: string;
};

export const DEVICE_ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const TELEMETRY_FRESH_MS = 5 * 60 * 1000;

export function isDeviceOnline(device: DeviceWithUpdatedAt, now = Date.now()) {
  return now - new Date(device.updated_at).getTime() < DEVICE_ONLINE_WINDOW_MS;
}

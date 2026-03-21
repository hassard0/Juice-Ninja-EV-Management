/**
 * Format a time string (HH:MM or HH:MM:SS) to 12h or 24h display.
 */
export function formatTime(time: string, format: "12h" | "24h" = "24h"): string {
  const parts = time.slice(0, 5); // "HH:MM"
  if (format === "24h") return parts;

  const [hStr, mStr] = parts.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${ampm}`;
}

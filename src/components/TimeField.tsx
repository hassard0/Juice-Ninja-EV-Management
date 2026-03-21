import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TimeFormat = "12h" | "24h";

type TimeFieldProps = {
  value: string;
  format: TimeFormat;
  onChange: (nextValue: string) => void;
  className?: string;
};

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad2 = (n: number) => String(n).padStart(2, "0");

function parseTime(value: string) {
  const base = value.slice(0, 5);
  const [rawH = "0", rawM = "0"] = base.split(":");
  const hour = Number.isFinite(Number(rawH)) ? Number(rawH) : 0;
  const minute = Number.isFinite(Number(rawM)) ? Number(rawM) : 0;
  return {
    hour24: Math.min(23, Math.max(0, hour)),
    minute: Math.min(59, Math.max(0, minute)),
  };
}

function to24Hour(hour12: number, meridiem: "AM" | "PM") {
  if (meridiem === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export default function TimeField({ value, format, onChange, className }: TimeFieldProps) {
  const { hour24, minute } = parseTime(value);

  const minuteValue = String(minute);
  const meridiem: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const apply24h = (nextHour24: number, nextMinute: number) => {
    onChange(`${pad2(nextHour24)}:${pad2(nextMinute)}`);
  };

  return (
    <div className={cn("grid grid-cols-2 gap-2", format === "12h" && "grid-cols-3", className)}>
      {format === "24h" ? (
        <Select value={String(hour24)} onValueChange={(nextHour) => apply24h(parseInt(nextHour, 10), minute)}>
          <SelectTrigger>
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent>
            {HOURS_24.map((hour) => (
              <SelectItem key={hour} value={String(hour)}>{pad2(hour)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select
          value={String(hour12)}
          onValueChange={(nextHour) => apply24h(to24Hour(parseInt(nextHour, 10), meridiem), minute)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent>
            {HOURS_12.map((hour) => (
              <SelectItem key={hour} value={String(hour)}>{pad2(hour)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={minuteValue} onValueChange={(nextMinute) => apply24h(hour24, parseInt(nextMinute, 10))}>
        <SelectTrigger>
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={String(m)}>{pad2(m)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {format === "12h" && (
        <Select value={meridiem} onValueChange={(nextMeridiem) => apply24h(to24Hour(hour12, nextMeridiem as "AM" | "PM"), minute)}>
          <SelectTrigger>
            <SelectValue placeholder="AM/PM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

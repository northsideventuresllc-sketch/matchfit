/**
 * Worldwide IANA timezone options for trainer booking / availability display.
 *
 * Worldwide (MF-WORLDWIDE-UI-TEXT): this list used to be US_BOOKING_TIMEZONE_OPTIONS,
 * eight US-only zones, with any other value silently forced back to America/New_York.
 * That meant a coach based outside the US could never show clients their real local
 * time. The dropdown below covers one representative zone per UTC offset used by a
 * DST-observing region plus common non-US business hubs; normalizeBookingTimezone
 * now accepts ANY valid IANA zone (validated via Intl, not restricted to this list) so
 * a coach whose exact city isn't in the short list can still be sent a valid zone by
 * any other part of the app.
 */
export const BOOKING_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Pacific/Midway", label: "UTC-11 — Midway" },
  { value: "Pacific/Honolulu", label: "Hawaii — Honolulu" },
  { value: "America/Anchorage", label: "Alaska — Anchorage" },
  { value: "America/Los_Angeles", label: "Pacific (US/Canada) — Los Angeles" },
  { value: "America/Phoenix", label: "Arizona — Phoenix" },
  { value: "America/Denver", label: "Mountain (US/Canada) — Denver" },
  { value: "America/Chicago", label: "Central (US/Canada) — Chicago" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/New_York", label: "Eastern (US/Canada) — New York" },
  { value: "America/Halifax", label: "Atlantic — Halifax" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "Atlantic/Azores", label: "Azores" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Lisbon", label: "Lisbon" },
  { value: "Europe/Paris", label: "Paris / Berlin / Madrid" },
  { value: "Europe/Athens", label: "Athens / Helsinki" },
  { value: "Europe/Moscow", label: "Moscow" },
  { value: "Africa/Cairo", label: "Cairo" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Africa/Lagos", label: "Lagos" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Karachi", label: "Karachi" },
  { value: "Asia/Kolkata", label: "Mumbai / New Delhi" },
  { value: "Asia/Dhaka", label: "Dhaka" },
  { value: "Asia/Bangkok", label: "Bangkok / Jakarta" },
  { value: "Asia/Shanghai", label: "Beijing / Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo / Seoul" },
  { value: "Australia/Sydney", label: "Sydney / Melbourne" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

const DEFAULT_BOOKING_TIMEZONE = "America/New_York";

/** True if `tz` is a real IANA timezone identifier the runtime can format with. */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz.trim()) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * Accepts any valid IANA zone (not just the curated dropdown options above) so a
 * worldwide coach's timezone is never silently swapped for a US one. Only an empty
 * or genuinely invalid identifier falls back to the schema default.
 */
export function normalizeBookingTimezone(raw: string | null | undefined): string {
  const t = raw?.trim() || "";
  if (!t) return DEFAULT_BOOKING_TIMEZONE;
  return isValidIanaTimezone(t) ? t : DEFAULT_BOOKING_TIMEZONE;
}

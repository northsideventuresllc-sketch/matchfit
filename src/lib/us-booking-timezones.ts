/** US IANA zones only — used for trainer booking / availability display. */
export const US_BOOKING_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Honolulu", label: "Hawaii — Honolulu" },
  { value: "America/Anchorage", label: "Alaska — Anchorage" },
  { value: "America/Los_Angeles", label: "Pacific — Los Angeles" },
  { value: "America/Phoenix", label: "Arizona — Phoenix" },
  { value: "America/Denver", label: "Mountain — Denver" },
  { value: "America/Chicago", label: "Central — Chicago" },
  { value: "America/New_York", label: "Eastern — New York" },
  { value: "America/Puerto_Rico", label: "Atlantic — Puerto Rico" },
];

export function normalizeUsBookingTimezone(raw: string | null | undefined): string {
  const t = raw?.trim() || "";
  const hit = US_BOOKING_TIMEZONE_OPTIONS.find((o) => o.value === t);
  return hit ? hit.value : "America/New_York";
}

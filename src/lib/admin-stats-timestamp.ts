/** Format admin dashboard snapshot time for display (UTC + local). */

export function formatAdminStatsTimestamp(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const utc = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone?.trim() || undefined,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

  if (!timeZone?.trim() || utc === local) {
    return `${utc} UTC`;
  }
  return `${utc} UTC (${local} local)`;
}

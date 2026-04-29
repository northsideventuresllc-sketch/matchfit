/** America/New_York calendar helpers for featured placement windows (single platform-wide cutoff). */

export const FEATURED_PLATFORM_TIMEZONE = "America/New_York";

export function getEasternDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FEATURED_PLATFORM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Smallest UTC instant whose Eastern calendar date is `dayKey` (YYYY-MM-DD). */
export function easternDayStartUtcMs(dayKey: string): number {
  const [y, mo, da] = dayKey.split("-").map((s) => parseInt(s, 10));
  let lo = Date.UTC(y, mo - 1, da - 1);
  let hi = Date.UTC(y, mo - 1, da + 2);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const key = getEasternDateKey(new Date(mid));
    if (key >= dayKey) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Eastern calendar date immediately following `dayKey`. */
export function nextEasternDayKey(dayKey: string): string {
  const start = easternDayStartUtcMs(dayKey);
  return getEasternDateKey(new Date(start + 30 * 60 * 60 * 1000));
}

/** Display day trainers are currently submitting entries/bids for (always the next Eastern calendar day). */
export function entryTargetDisplayDayKey(now: Date = new Date()): string {
  return nextEasternDayKey(getEasternDateKey(now));
}

/** Which display day the public home page should read allocations for. */
export function homepageDisplayDayKey(now: Date = new Date()): string {
  return getEasternDateKey(now);
}

/** Human-readable label for an Eastern calendar `YYYY-MM-DD` key (trainer-facing copy). */
export function formatFeaturedDisplayDayLabel(dayKey: string): string {
  const parts = dayKey.split("-").map((s) => parseInt(s, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return dayKey;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: FEATURED_PLATFORM_TIMEZONE,
  }).format(new Date(Date.UTC(y, m - 1, d, 17, 0, 0)));
}

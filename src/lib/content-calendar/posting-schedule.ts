import { formatCalendarDate } from "@/lib/content-calendar/rotation";
import { estDateString } from "@/lib/content-calendar/schedule-utils";

/** Match Fit social posting days (America/New_York). */
export const CONTENT_CALENDAR_SOCIAL_POSTING_WEEKDAYS = [1, 3, 5] as const; // Mon, Wed, Fri

/** After this hour (EST/EDT), same-day posting slots roll to the next posting day. */
export const CONTENT_CALENDAR_SOCIAL_POSTING_CUTOFF_HOUR_EST = 17;

const EASTERN_TZ = "America/New_York";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function easternWeekdayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  const short = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TZ, weekday: "short" }).format(probe);
  return WEEKDAY_INDEX[short] ?? 0;
}

function easternHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return formatCalendarDate(new Date(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()));
}

function isSocialPostingWeekday(weekday: number): boolean {
  return (CONTENT_CALENDAR_SOCIAL_POSTING_WEEKDAYS as readonly number[]).includes(weekday);
}

/** 0=Mon..4=Fri for a date key (America/New_York), or null for a Sat/Sun date. */
export function getContentCalendarWeekdayIndex(dateKey: string): number | null {
  const weekday = easternWeekdayIndex(dateKey); // Sun=0..Sat=6
  return weekday >= 1 && weekday <= 5 ? weekday - 1 : null;
}

/**
 * Returns the next N calendar dates that align with the live social posting rhythm
 * (Mon / Wed / Fri). After 5pm Eastern, the current day is skipped even on posting days.
 */
export function getSocialPostingDateKeys(args: { count: number; now?: Date }): string[] {
  const count = Math.max(0, args.count);
  if (count === 0) return [];

  const now = args.now ?? new Date();
  const hour = easternHour(now);
  let cursor = estDateString(now);
  const todayWeekday = easternWeekdayIndex(cursor);
  const canUseToday =
    isSocialPostingWeekday(todayWeekday) && hour < CONTENT_CALENDAR_SOCIAL_POSTING_CUTOFF_HOUR_EST;

  if (!canUseToday) {
    cursor = addDaysToDateKey(cursor, 1);
  }

  const out: string[] = [];
  while (out.length < count) {
    if (isSocialPostingWeekday(easternWeekdayIndex(cursor))) {
      out.push(cursor);
    }
    cursor = addDaysToDateKey(cursor, 1);
  }
  return out;
}

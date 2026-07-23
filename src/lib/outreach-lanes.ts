/**
 * Outreach HQ v2 — pure lane + America/New_York scheduling helpers.
 *
 * No DB / no `server-only` import: everything here is deterministic given `now`, so the cron
 * libs and route handlers stay thin and the logic is unit-testable. DST is handled via
 * `Intl.DateTimeFormat` short-offset probing (same approach as content-calendar/schedule-utils).
 */

import type { OutreachDispatchSlot } from "@/lib/outreach-types";
import { OUTREACH_DISPATCH_SLOT_HOURS } from "@/lib/outreach-types";

const MS_HOUR = 3_600_000;

/** YYYY-MM-DD calendar date in America/New_York for the given instant. */
export function estDateString(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** The America/New_York UTC offset (in hours, e.g. -4 for EDT, -5 for EST) at a given instant. */
export function estOffsetHours(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  }).formatToParts(at);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const match = offsetPart.match(/GMT([+-]\d+)/);
  return match ? Number.parseInt(match[1], 10) : -5;
}

/** UTC instant for a wall-clock America/New_York time (`hour:minute` on the given Y-M-D). */
export function estWallClockToUtc(
  year: number,
  month1: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  // Probe noon UTC on the target date to resolve the correct EST/EDT offset, then apply it.
  const probe = new Date(Date.UTC(year, month1 - 1, day, 12, 0, 0));
  const offsetHours = estOffsetHours(probe);
  return new Date(Date.UTC(year, month1 - 1, day, hour, minute, 0) - offsetHours * MS_HOUR);
}

/** Start-of-day (00:00 America/New_York) for `now`, expressed as a UTC instant. */
export function startOfEstDayUtc(now: Date = new Date()): Date {
  const [y, m, d] = estDateString(now).split("-").map(Number);
  return estWallClockToUtc(y, m, d, 0, 0);
}

/** Parts (year/month/day/hour/minute) of `now` in America/New_York wall-clock. */
function estParts(now: Date): { year: number; month1: number; day: number; hour: number } {
  const [y, m, d] = estDateString(now).split("-").map(Number);
  const hour = Number(
    now.toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hour12: false,
    }).replace(/[^0-9]/g, ""),
  );
  return { year: y, month1: m, day: d, hour: hour === 24 ? 0 : hour };
}

/**
 * The next upcoming 1pm or 4pm America/New_York dispatch slot at or after `now`.
 * Before 1pm → 1pm today · 1pm–4pm → 4pm today · after 4pm → 1pm tomorrow.
 */
export function nextDispatchSlot(now: Date = new Date()): {
  slot: OutreachDispatchSlot;
  scheduledFor: Date;
} {
  const { year, month1, day, hour } = estParts(now);

  if (hour < OUTREACH_DISPATCH_SLOT_HOURS["13:00"]) {
    return { slot: "13:00", scheduledFor: estWallClockToUtc(year, month1, day, 13, 0) };
  }
  if (hour < OUTREACH_DISPATCH_SLOT_HOURS["16:00"]) {
    return { slot: "16:00", scheduledFor: estWallClockToUtc(year, month1, day, 16, 0) };
  }
  // After 4pm ET — roll to 1pm on the next calendar day (noon-anchored to dodge DST edges).
  const nextDayNoon = new Date(estWallClockToUtc(year, month1, day, 12, 0).getTime() + 24 * MS_HOUR);
  const next = estParts(nextDayNoon);
  return {
    slot: "13:00",
    scheduledFor: estWallClockToUtc(next.year, next.month1, next.day, 13, 0),
  };
}

/**
 * True when a `today`-lane lead should flip to `past_due`: its queued date is strictly before
 * the current America/New_York calendar day.
 */
export function isPastDueForToday(queuedForDate: Date | null, now: Date = new Date()): boolean {
  if (!queuedForDate) return false;
  return estDateString(queuedForDate) < estDateString(now);
}

/**
 * True when a follow-up reminder should fire: the due time has passed and it has either never
 * been reminded or the last reminder was more than `intervalHours` ago.
 */
export function followUpReminderDue(args: {
  dueAt: Date | null;
  lastRemindedAt: Date | null;
  now?: Date;
  intervalHours: number;
}): boolean {
  const { dueAt, lastRemindedAt, intervalHours } = args;
  if (!dueAt) return false;
  const now = args.now ?? new Date();
  if (dueAt.getTime() > now.getTime()) return false;
  if (!lastRemindedAt) return true;
  return now.getTime() - lastRemindedAt.getTime() >= intervalHours * MS_HOUR;
}

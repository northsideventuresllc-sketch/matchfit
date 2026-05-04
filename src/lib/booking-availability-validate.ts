import type { TrainerBookingAvailability } from "@/lib/booking-availability";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local calendar days touched by [startIso, endIso). */
function eachLocalDayInRange(startIso: string, endIso: string): { ymd: string; dow: number }[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];
  const out: { ymd: string; dow: number }[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur.getTime() <= endDay.getTime()) {
    out.push({ ymd: localYmd(cur), dow: cur.getDay() });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Returns human-readable conflict messages. Empty means the document is internally consistent
 * for weekly hours, recurring blackouts, one-off blackouts, and one-off openings.
 */
export function validateTrainerAvailabilityConsistency(doc: TrainerBookingAvailability): string[] {
  const errs: string[] = [];
  const weekly = doc.weeklyRules ?? [];
  const offW = doc.unavailableWeekdaysAllDay ?? [];
  const off1 = doc.unavailableDatesOnce ?? [];
  const slots = doc.specificSlots ?? [];

  const byDow = new Map<number, { start: number; end: number }[]>();
  for (const r of weekly) {
    if (r.endMinutes <= r.startMinutes || r.endMinutes > 24 * 60) continue;
    const arr = byDow.get(r.dayOfWeek) ?? [];
    arr.push({ start: r.startMinutes, end: r.endMinutes });
    byDow.set(r.dayOfWeek, arr);
  }
  for (const [dow, ranges] of byDow) {
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    for (let k = 0; k < sorted.length - 1; k++) {
      if (sorted[k + 1]!.start < sorted[k]!.end) {
        errs.push(`Weekly hours overlap on ${DAY_NAMES[dow] ?? "that day"}.`);
        break;
      }
    }
  }

  const offDow = new Set(offW.map((x) => x.dayOfWeek));
  for (const r of weekly) {
    if (offDow.has(r.dayOfWeek)) {
      errs.push(
        `Every ${DAY_NAMES[r.dayOfWeek]} is fully blocked, but you also have weekly hours that day. Remove the blackout or the weekly window.`,
      );
      break;
    }
  }

  /** One-off blackouts may fall on a weekday that has weekly hours — they override that calendar date only (not an error). */
  for (const o of off1) {
    const parts = o.date.split("-").map((x) => parseInt(x, 10));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) continue;
    const dt = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
    if (Number.isNaN(dt.getTime())) continue;
    const dow = dt.getDay();
    if (offDow.has(dow)) {
      errs.push(`Blocked date ${o.date} is already covered by your recurring “every ${DAY_NAMES[dow]}” blackout. Remove one entry.`);
    }
  }

  for (let si = 0; si < slots.length; si++) {
    const s = slots[si]!;
    const a = new Date(s.startAt);
    const b = new Date(s.endAt);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) {
      errs.push(`One-off opening #${si + 1} has invalid start/end times.`);
      continue;
    }
    const days = eachLocalDayInRange(s.startAt, s.endAt);
    for (const { ymd, dow } of days) {
      if (off1.some((o) => o.date === ymd)) {
        errs.push(`One-off opening overlaps blocked date ${ymd}.`);
      }
      if (offDow.has(dow)) {
        errs.push(`One-off opening spans ${DAY_NAMES[dow]}, which is fully blocked every week.`);
        break;
      }
    }
  }

  return [...new Set(errs)];
}

export type AvailabilityCalendarHit =
  | { kind: "weekly"; index: number; label: string }
  | { kind: "weeklyPausedForDate"; label: string }
  | { kind: "blackoutWeek"; index: number; label: string }
  | { kind: "blackoutOnce"; index: number; label: string }
  | { kind: "specific"; index: number; label: string };

export function availabilityHitsForLocalDate(
  doc: TrainerBookingAvailability,
  ymd: string,
  dow: number,
): AvailabilityCalendarHit[] {
  const hits: AvailabilityCalendarHit[] = [];
  const onceBlackoutDates = new Set((doc.unavailableDatesOnce ?? []).map((x) => x.date));
  /** One-off blackout on this date hides repeating weekly hours for that date only. */
  const weeklyHiddenByDateOverride = onceBlackoutDates.has(ymd);
  const weekly = doc.weeklyRules ?? [];
  weekly.forEach((r, index) => {
    if (r.dayOfWeek !== dow) return;
    if (r.endMinutes <= r.startMinutes) return;
    if (weeklyHiddenByDateOverride) return;
    const label = `${DAY_NAMES[r.dayOfWeek]} ${formatHm(r.startMinutes)}–${formatHm(r.endMinutes)} (weekly)`;
    hits.push({ kind: "weekly", index, label });
  });
  (doc.unavailableWeekdaysAllDay ?? []).forEach((u, index) => {
    if (u.dayOfWeek !== dow) return;
    hits.push({ kind: "blackoutWeek", index, label: `Every ${DAY_NAMES[u.dayOfWeek]} — all day` });
  });
  (doc.unavailableDatesOnce ?? []).forEach((u, index) => {
    if (u.date !== ymd) return;
    hits.push({ kind: "blackoutOnce", index, label: `Blocked — ${u.date}` });
  });
  if (weeklyHiddenByDateOverride) {
    const wr = weekly.filter((r) => r.dayOfWeek === dow && r.endMinutes > r.startMinutes);
    if (wr.length > 0) {
      hits.push({
        kind: "weeklyPausedForDate",
        label: `${DAY_NAMES[dow]} repeating hours are off on this date only (remove the one-day blackout to restore them).`,
      });
    }
  }
  (doc.specificSlots ?? []).forEach((s, index) => {
    const days = eachLocalDayInRange(s.startAt, s.endAt);
    if (!days.some((d) => d.ymd === ymd)) return;
    const a = new Date(s.startAt);
    const b = new Date(s.endAt);
    hits.push({
      kind: "specific",
      index,
      label: `Extra opening · ${a.toLocaleString([], { dateStyle: "short", timeStyle: "short" })} – ${b.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`,
    });
  });
  return hits;
}

function formatHm(mins: number): string {
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

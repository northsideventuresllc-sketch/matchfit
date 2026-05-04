import { z } from "zod";

const weeklyRuleSchema = z.object({
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: z.number().int().min(0).max(6),
  /** Minutes from midnight local to trainer timezone, e.g. 9*60+30 */
  startMinutes: z.number().int().min(0).max(24 * 60 - 1),
  endMinutes: z.number().int().min(1).max(24 * 60),
});

const specificSlotSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const unavailableDateOnceSchema = z.object({
  /** Calendar date in the trainer’s booking timezone (YYYY-MM-DD). */
  date: ymdSchema,
});

const unavailableWeekdayAllDaySchema = z.object({
  /** 0 = Sunday … 6 = Saturday — repeats every week, all day unavailable. */
  dayOfWeek: z.number().int().min(0).max(6),
});

export const trainerBookingAvailabilitySchema = z
  .object({
    schemaVersion: z.literal(1),
    guidelinesText: z.string().trim().max(2000).optional(),
    weeklyRules: z.array(weeklyRuleSchema).max(14).optional(),
    /** One-off extra openings (non-repeating), stored as ISO datetimes. */
    specificSlots: z.array(specificSlotSchema).max(80).optional(),
    /** One-off entire calendar days off (trainer-local dates). */
    unavailableDatesOnce: z.array(unavailableDateOnceSchema).max(366).optional(),
    /** Recurring: every week this weekday is fully blocked. */
    unavailableWeekdaysAllDay: z.array(unavailableWeekdayAllDaySchema).max(7).optional(),
  })
  .superRefine((val, ctx) => {
    const ws = val.unavailableWeekdaysAllDay ?? [];
    const seen = new Set<number>();
    for (const w of ws) {
      if (seen.has(w.dayOfWeek)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["unavailableWeekdaysAllDay"], message: "Each weekday may appear once." });
        return;
      }
      seen.add(w.dayOfWeek);
    }
    const once = val.unavailableDatesOnce ?? [];
    const datesSeen = new Set<string>();
    for (const o of once) {
      if (datesSeen.has(o.date)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["unavailableDatesOnce"], message: "Duplicate blackout dates." });
        return;
      }
      datesSeen.add(o.date);
    }
  });

export type TrainerBookingAvailability = z.infer<typeof trainerBookingAvailabilitySchema>;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm.toString().padStart(2, "0")} ${ampm}`;
}

function minutesValid(start: number, end: number): boolean {
  return end > start && end <= 24 * 60;
}

/**
 * Public copy for profile + availability page.
 * Returns `contact` when slots look one-off / irregular (hyperspecific).
 */
export function summarizeTrainerAvailabilityForPublic(
  rawJson: string | null | undefined,
  timezoneLabel: string,
): { mode: "pattern" | "contact"; lines: string[] } {
  if (!rawJson?.trim()) {
    return { mode: "contact", lines: ["Please contact the trainer to find out availability."] };
  }
  let doc: TrainerBookingAvailability;
  try {
    const parsed = trainerBookingAvailabilitySchema.safeParse(JSON.parse(rawJson) as unknown);
    if (!parsed.success) {
      return { mode: "contact", lines: ["Please contact the trainer to find out availability."] };
    }
    doc = parsed.data;
  } catch {
    return { mode: "contact", lines: ["Please contact the trainer to find out availability."] };
  }

  const lines: string[] = [];
  const g = doc.guidelinesText?.trim();
  if (g) lines.push(g);

  const weekly = doc.weeklyRules ?? [];
  const slots = doc.specificSlots ?? [];
  const offOnce = doc.unavailableDatesOnce ?? [];
  const offWeekly = doc.unavailableWeekdaysAllDay ?? [];

  if (offWeekly.length) {
    const names = offWeekly.map((x) => DAY_NAMES[x.dayOfWeek] ?? "").filter(Boolean);
    if (names.length) {
      lines.push(`Not available (recurring, all day): ${names.join(", ")} (${timezoneLabel}).`);
    }
  }
  if (offOnce.length) {
    const sorted = [...offOnce].map((x) => x.date).sort();
    const preview = sorted.slice(0, 6).join(", ");
    const more = sorted.length > 6 ? ` +${sorted.length - 6} more` : "";
    lines.push(`Blocked dates: ${preview}${more}.`);
  }

  /** Heuristic: many unrelated one-off slots → ask client to contact coach. */
  const hyperspecific =
    slots.length > 14 ||
    (slots.length > 6 && weekly.length === 0) ||
    (slots.length > 0 && weekly.length === 0 && slots.length > 4 && !slotsShareSameWeekdayPattern(slots));

  if (hyperspecific) {
    return {
      mode: "contact",
      lines: [
        ...lines,
        "Availability is very specific to certain dates. Please contact the trainer to find out availability.",
      ],
    };
  }

  if (weekly.length) {
    const grouped = new Map<number, { start: number; end: number }[]>();
    for (const r of weekly) {
      if (!minutesValid(r.startMinutes, r.endMinutes)) continue;
      const arr = grouped.get(r.dayOfWeek) ?? [];
      arr.push({ start: r.startMinutes, end: r.endMinutes });
      grouped.set(r.dayOfWeek, arr);
    }
    for (const [dow, ranges] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
      const label = DAY_NAMES[dow] ?? `Day ${dow}`;
      const parts = ranges.map((x) => `${formatMinutes(x.start)}–${formatMinutes(x.end)}`);
      if (parts.length) {
        lines.push(`${label}s · ${parts.join(" & ")} (${timezoneLabel})`);
      }
    }
  }

  if (slots.length && weekly.length === 0) {
    lines.push(`${slots.length} upcoming time window(s) — see booking link in chat after purchase (${timezoneLabel}).`);
  }

  if (lines.length === 0) {
    return { mode: "contact", lines: ["Please contact the trainer to find out availability."] };
  }
  return { mode: "pattern", lines };
}

function slotsShareSameWeekdayPattern(slots: { startAt: string; endAt: string }[]): boolean {
  const dows = new Set<number>();
  for (const s of slots) {
    const d = new Date(s.startAt);
    if (!Number.isNaN(d.getTime())) dows.add(d.getUTCDay());
  }
  return dows.size <= 2;
}

export function defaultTrainerBookingAvailability(): TrainerBookingAvailability {
  return {
    schemaVersion: 1,
    weeklyRules: [],
    specificSlots: [],
    unavailableDatesOnce: [],
    unavailableWeekdaysAllDay: [],
  };
}

/**
 * Plain-English "when does this actually happen" maths for the Pending page.
 *
 * Two real schedules drive it, both America/New_York, Monday–Friday only:
 *
 *  - Media build: 8:30am, 4:15pm, 7:15pm
 *    (`.github/workflows/match-fit-content-calendar-generate-media.yml`)
 *  - Posting:     5:00pm, 8:00pm
 *    (`.github/workflows/match-fit-content-calendar-post-batch.yml`)
 *
 * The GitHub workflows are pinned to fixed UTC crons, so they drift by an hour during EST. This
 * module works from the ET wall-clock times the workflows are *documented* to hold, because that is
 * what the operator is being shown. Everything here is pure and takes an injectable `now` so it can
 * be tested without freezing the clock.
 */

const EASTERN_TZ = "America/New_York";

export type EtClockSlot = { hour: number; minute: number };

/** Media generation slots, ET, weekdays only. */
export const MEDIA_BUILD_SLOTS_ET: EtClockSlot[] = [
  { hour: 8, minute: 30 },
  { hour: 16, minute: 15 },
  { hour: 19, minute: 15 },
];

/** Posting windows, ET, weekdays only. */
export const POSTING_SLOTS_ET: EtClockSlot[] = [
  { hour: 17, minute: 0 },
  { hour: 20, minute: 0 },
];

type EtDate = { year: number; month: number; day: number };
type EtWallClock = EtDate & { hour: number; minute: number };

/** UTC offset of America/New_York at a given instant, in minutes (e.g. -240 during EDT). */
function etOffsetMinutes(instant: Date): number {
  const label =
    new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TZ, timeZoneName: "shortOffset" })
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return -300;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? "0"));
}

/** ET wall-clock reading of an instant. */
export function etWallClock(instant: Date): EtWallClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    // Some ICU builds report midnight as hour 24 under hour12:false.
    hour: read("hour") % 24,
    minute: read("minute"),
  };
}

/**
 * The instant at which a given ET calendar day hits a given ET wall-clock time. Resolved in two
 * passes so a DST changeover day picks the offset that is actually in force at the result.
 */
export function etInstant(day: EtDate, slot: EtClockSlot): Date {
  const naive = Date.UTC(day.year, day.month - 1, day.day, slot.hour, slot.minute, 0, 0);
  const firstPass = naive - etOffsetMinutes(new Date(naive)) * 60_000;
  return new Date(naive - etOffsetMinutes(new Date(firstPass)) * 60_000);
}

function addEtDays(day: EtDate, days: number): EtDate {
  const shifted = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function etDayNumber(day: EtDate): number {
  return Math.floor(Date.UTC(day.year, day.month - 1, day.day) / 86_400_000);
}

function isWeekend(day: EtDate): boolean {
  const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/**
 * The next weekday slot strictly after `after`. Weekends are skipped entirely — a Friday-evening
 * post that misses the last slot rolls to Monday morning.
 */
export function nextEtSlotAfter(slots: EtClockSlot[], after: Date): Date {
  let cursor: EtDate = etWallClock(after);
  for (let offset = 0; offset < 14; offset += 1) {
    if (!isWeekend(cursor)) {
      for (const slot of slots) {
        const instant = etInstant(cursor, slot);
        if (instant.getTime() > after.getTime()) return instant;
      }
    }
    cursor = addEtDays(cursor, 1);
  }
  // Unreachable with a non-empty slot list; keeps the return type honest.
  return etInstant(cursor, slots[0] ?? { hour: 9, minute: 0 });
}

/** "8:30am", "4:15pm", "8pm" — no minutes shown when it lands on the hour. */
export function etTimeLabel(instant: Date): string {
  const wall = etWallClock(instant);
  const hour12 = wall.hour % 12 === 0 ? 12 : wall.hour % 12;
  const suffix = wall.hour < 12 ? "am" : "pm";
  if (wall.minute === 0) return `${hour12}${suffix}`;
  return `${hour12}:${String(wall.minute).padStart(2, "0")}${suffix}`;
}

/** "Tue Jul 28" */
export function etDateLabel(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${read("weekday")} ${read("month")} ${read("day")}`;
}

/**
 * Friendly wording for a moment, with the real date attached whenever it is not today:
 * "tonight at 8pm", "this morning at 8:30am", "tomorrow, Tue Jul 28 at 8:30am", "Mon Aug 3 at 5pm".
 */
export function describeEtMoment(instant: Date, now: Date): string {
  const target = etWallClock(instant);
  const today = etWallClock(now);
  const dayGap = etDayNumber(target) - etDayNumber(today);
  const time = etTimeLabel(instant);

  if (dayGap === 0) {
    if (target.hour >= 17) return `tonight at ${time}`;
    if (target.hour < 12) return `this morning at ${time}`;
    return `this afternoon at ${time}`;
  }
  if (dayGap === 1) return `tomorrow, ${etDateLabel(instant)} at ${time}`;
  if (dayGap === -1) return `yesterday, ${etDateLabel(instant)} at ${time}`;
  return `${etDateLabel(instant)} at ${time}`;
}

/** Minimum shape the Pending page needs to work out timings for one post. */
export type PendingSchedulePost = {
  postType: string;
  mediaStatus: "none" | "generating" | "ready" | "failed" | string;
  mediaUrls: string[];
  scheduledAt: string | null;
};

export type PendingScheduleView = {
  /** True when nothing more has to be built before this post can go out. */
  mediaReady: boolean;
  /** One plain sentence about the media. */
  mediaLine: string;
  /** One plain sentence about when it goes out. */
  postLine: string;
  /** Short badge wording for the media state. */
  mediaBadge: string;
  /** When the media is expected to be built, or null when there is nothing to build. */
  mediaAt: Date | null;
  /** When the post is expected to go out. */
  postAt: Date;
  /** True when JB picked an exact posting time rather than the automatic window. */
  postTimeIsExact: boolean;
};

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function parseIso(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Turns one pending post into the two plain sentences JB asked for: when the pictures get made and
 * when the post goes out. Posting never lands before the media it needs, so a post whose images are
 * built at 7:15pm is shown going out at 8pm rather than 5pm.
 */
export function describePendingPost(post: PendingSchedulePost, now: Date = new Date()): PendingScheduleView {
  const needsMedia = post.postType !== "Text";
  const hasFiles = post.mediaUrls.length > 0;
  const mediaReady = !needsMedia || post.mediaStatus === "ready" || hasFiles;

  const mediaAt = mediaReady ? null : nextEtSlotAfter(MEDIA_BUILD_SLOTS_ET, now);

  let mediaLine: string;
  let mediaBadge: string;
  if (!needsMedia) {
    mediaLine = "This one is words only — there is nothing to build.";
    mediaBadge = "Words only";
  } else if (mediaReady) {
    mediaLine = "Pictures are ready and attached.";
    mediaBadge = "Pictures ready";
  } else if (post.mediaStatus === "generating") {
    mediaLine = "Pictures are being made right now.";
    mediaBadge = "Being made now";
  } else if (post.mediaStatus === "failed") {
    mediaLine = "Pictures did not come out. Send it back to drafts and try again.";
    mediaBadge = "Needs another go";
  } else {
    mediaLine = sentence(`pictures build ${describeEtMoment(mediaAt as Date, now)}.`);
    mediaBadge = "Still to build";
  }

  const exact = parseIso(post.scheduledAt);
  const useExact = Boolean(exact && exact.getTime() > now.getTime());
  const postAt = useExact
    ? (exact as Date)
    : nextEtSlotAfter(POSTING_SLOTS_ET, mediaAt && mediaAt.getTime() > now.getTime() ? mediaAt : now);

  return {
    mediaReady,
    mediaLine,
    mediaBadge,
    mediaAt,
    postAt,
    postTimeIsExact: useExact,
    postLine: sentence(`posts ${describeEtMoment(postAt, now)}.`),
  };
}

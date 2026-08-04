import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContentCalendarPostRow } from "@/lib/ni-brain-client";

/**
 * Match Fit posts go out in two nightly slots, 5pm and 8pm ET. `post_group` is the column the
 * posting runs select on, and they select STRICTLY on the literal '5pm' / '8pm' values — a NULL
 * makes a row invisible to posting even though it looks perfectly healthy in the calendar.
 *
 * Ticket MF-CALENDAR-POSTGROUP-NULL-RECURS: the weekly generator never wrote this column at all.
 * `createV2Draft` / `saveDraftToHub` build their INSERT payloads as explicit column whitelists and
 * `post_group` was simply not one of the listed keys, so every generated row fell through to the
 * column default (NULL). The DB check `mf_post_group_chk` permits NULL, so nothing caught it. It
 * was hand-repaired in-place on 2026-07-31 and again on 2026-08-03, which fixed the rows but not
 * the cause, so it came back with the next week's generation both times.
 */
export const CONTENT_CALENDAR_POST_GROUPS = ["5pm", "8pm"] as const;
export type ContentCalendarPostGroup = (typeof CONTENT_CALENDAR_POST_GROUPS)[number];

const CALENDAR_TABLE = "match_fit_content_calendar_posts";

/** Status stamped on a row we refuse to generate. Never 'draft' — it must not reach the approval queue. */
export const CONTENT_CALENDAR_BLOCKED_STATUS = "blocked";

/**
 * Anchor Monday. The slot for (week_start = 2026-08-03, day_index = 0) is 5pm.
 * Chosen because that week's grouping is the live, JB-visible sequence in NI-Brain.
 */
const POST_GROUP_ANCHOR_MONDAY = "2026-08-03";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function isValidPostGroup(value: unknown): value is ContentCalendarPostGroup {
  return typeof value === "string" && (CONTENT_CALENDAR_POST_GROUPS as readonly string[]).includes(value);
}

function mondayUtcMs(weekStart: string): number | null {
  if (typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart.trim())) return null;
  const [y, m, d] = weekStart.trim().split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  if (!Number.isFinite(ms)) return null;
  // Reject impossible dates that Date.UTC silently rolls over (e.g. 2026-02-31).
  const probe = new Date(ms);
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return ms;
}

/**
 * The 5pm / 8pm slots alternate on every posting weekday and keep alternating across week
 * boundaries. Five weekdays per week is an odd count, so the parity flips each week — which is
 * exactly the sequence the 07-31 and 08-03 hand repairs produced:
 *
 *   week 2026-07-27  d0 8pm
 *   week 2026-08-03  d0 5pm  d1 8pm  d2 5pm  d3 8pm  d4 5pm
 *   week 2026-08-10  d0 8pm  d1 5pm  d2 8pm  d3 5pm  d4 8pm
 *
 * Returns null (never a silent default) when the inputs cannot produce a real slot, so callers are
 * forced to handle the failure instead of writing a broken row.
 */
export function resolvePostGroup(args: { weekStart: string; dayIndex: number }): ContentCalendarPostGroup | null {
  const weekMs = mondayUtcMs(args.weekStart);
  if (weekMs === null) return null;
  if (!Number.isInteger(args.dayIndex) || args.dayIndex < 0 || args.dayIndex > 4) return null;

  const anchorMs = mondayUtcMs(POST_GROUP_ANCHOR_MONDAY);
  if (anchorMs === null) return null;

  const weeks = Math.round((weekMs - anchorMs) / MS_PER_WEEK);
  const ordinal = weeks * 5 + args.dayIndex;
  // JS % keeps the sign of the dividend; weeks before the anchor are negative.
  const parity = ((ordinal % 2) + 2) % 2;
  return parity === 0 ? "5pm" : "8pm";
}

export function describePostGroupFailure(args: { weekStart: string; dayIndex: number; source: string }): string {
  return [
    `[${args.source}] BLOCKED: post_group could not be resolved, so this post was not generated as a draft.`,
    `week_start=${JSON.stringify(args.weekStart)} day_index=${JSON.stringify(args.dayIndex)}.`,
    "week_start must be a real YYYY-MM-DD Monday and day_index must be an integer 0-4.",
    "A NULL post_group is invisible to the 5pm/8pm posting runs, so the row is refused rather than",
    "written as a draft that would silently never post (ticket MF-CALENDAR-POSTGROUP-NULL-RECURS).",
  ].join(" ");
}

function sanitizeForBlockedRow(args: { weekStart: string; dayIndex: number }): { weekStart: string; dayIndex: number } {
  // The blocked row is an audit record and still has to satisfy the DB constraints
  // (week_start NOT NULL, day_index 0-4). The untouched real values live in scrap_reason.
  const weekStart = mondayUtcMs(args.weekStart) === null ? POST_GROUP_ANCHOR_MONDAY : args.weekStart.trim();
  const dayIndex =
    Number.isInteger(args.dayIndex) && args.dayIndex >= 0 && args.dayIndex <= 4 ? args.dayIndex : 0;
  return { weekStart, dayIndex };
}

/**
 * The single insert gate for generated calendar rows.
 *
 * Resolves `post_group` and writes it with the row. If it cannot be resolved, NO draft is created —
 * instead a `blocked` row carrying the reason in `scrap_reason` is written (archived, unscheduled,
 * so it can never be approved or posted) and the call throws. That turns a silent weekly data
 * defect into a loud, readable one.
 */
export async function insertGeneratedCalendarRow(args: {
  client: SupabaseClient;
  row: Record<string, unknown>;
  weekStart: string;
  dayIndex: number;
  source: string;
}): Promise<ContentCalendarPostRow> {
  const postGroup = resolvePostGroup({ weekStart: args.weekStart, dayIndex: args.dayIndex });

  if (!isValidPostGroup(postGroup)) {
    const reason = describePostGroupFailure({
      weekStart: args.weekStart,
      dayIndex: args.dayIndex,
      source: args.source,
    });
    const safe = sanitizeForBlockedRow({ weekStart: args.weekStart, dayIndex: args.dayIndex });
    const now = new Date().toISOString();

    const { error: blockedError } = await args.client.from(CALENDAR_TABLE).insert({
      ...args.row,
      week_start: safe.weekStart,
      day_index: safe.dayIndex,
      post_group: null,
      status: CONTENT_CALENDAR_BLOCKED_STATUS,
      scrap_reason: reason,
      is_scheduled: false,
      posted: false,
      workflow_stage: "archived",
      archive_type: "scrapped",
      archived_at: now,
      updated_at: now,
    });

    throw new Error(
      blockedError ? `${reason} (blocked-row write also failed: ${blockedError.message})` : reason,
    );
  }

  const { data, error } = await args.client
    .from(CALENDAR_TABLE)
    .insert({ ...args.row, post_group: postGroup })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentCalendarPostRow;
}

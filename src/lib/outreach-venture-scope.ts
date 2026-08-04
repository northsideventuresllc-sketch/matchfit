/**
 * OUTREACH LANE SEPARATION — one venture per screen, never mixed.
 *
 * JB LOCKED (nvg-four-workflows + operating rules v2 §7):
 *   "Send switches, surfaces, lanes: separate per venture. Never share a screen."
 *   Match Fit outreach lives ONLY in Match Fit Outreach HQ.
 *   NI outreach lives ONLY in NI Outreach HQ.
 *
 * This app IS the Match Fit app, so every existing outreach screen and every
 * existing follow-up cron here is a MATCH FIT surface. Once the lead tables
 * started carrying a `ventureId` (Decision #388), rows belonging to another
 * venture — NI Services first — would otherwise have appeared in Match Fit's
 * Today / Hub / Archive tabs and been picked up by the Match Fit follow-up
 * cron, which sends with the Match Fit Resend key. Both are wrong.
 *
 * WHY `ventureId IS NULL` IS INCLUDED: nullable-on-purpose FKs (see the schema
 * comment on OutreachEmailLead). A Match Fit lead generated before the
 * generator started stamping a venture has a NULL `ventureId`. Excluding NULLs
 * would silently empty JB's screen. Unassigned therefore reads as Match Fit —
 * the only venture this app generates for — while any row explicitly stamped
 * with another venture is filtered out.
 */

import { MATCH_FIT_VENTURE_SLUG } from "@/lib/lead-taxonomy";

/**
 * Prisma `where` fragment restricting a query to Match Fit's lane.
 *
 * Always merge it through `AND` rather than spreading it, so it can never
 * collide with an `OR` the caller already uses (the Archives window does).
 */
export function matchFitLaneScope() {
  return {
    OR: [
      { ventureId: null },
      { venture: { is: { slug: MATCH_FIT_VENTURE_SLUG } } },
    ],
  };
}

/** Merge the Match Fit lane scope into an existing `where`, collision-free. */
export function scopedToMatchFit<T extends Record<string, unknown>>(where: T) {
  return { AND: [where, matchFitLaneScope()] };
}

/**
 * Prisma `where` fragment restricting a query to one named venture's lane.
 *
 * The mirror image of the Match Fit scope, and deliberately STRICTER: an
 * unassigned row is NOT claimed here. Only rows explicitly stamped with this
 * venture belong to it, so a Match Fit lead can never surface on another
 * venture's screen through a missing FK.
 */
export function scopedToVenture<T extends Record<string, unknown>>(where: T, ventureSlug: string) {
  return { AND: [where, { venture: { is: { slug: ventureSlug } } }] };
}

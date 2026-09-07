import { NextResponse, after } from "next/server";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import { runDailyContentGeneration, getDailyMissingPostTypes } from "@/lib/content-calendar/daily-generation";
import type { ContentCalendarPostType } from "@/lib/content-calendar/constants";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export const dynamic = "force-dynamic";
// Was 120 — observed live 2026-09-07 hitting "Task timed out after 120 seconds" (504) even after
// the per-post-type hop fix (MF-CONTENT-GEN-VERCEL-504-0907): the synchronous prep this route does
// before dispatching hops (hydratePlatformEnvFromDatabase + ensureContentCalendarV22Schema +
// getDailyMissingPostTypes) is the same shared prep content-calendar-weekly-generate does before
// its own hop dispatch — weekly budgets 300s for it (and does strictly more, including the full
// social-profile scan this route explicitly skips), so 120s here was never enough margin. Matching
// weekly's maxDuration removes that margin problem without changing the hop-fan-out shape.
export const maxDuration = 300;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

/**
 * Fans out one same-origin hop per missing post type, each acking immediately and doing its real
 * generation work in its own `after()` — so each type gets a fresh maxDuration budget instead of
 * sharing this invocation's. Proven live 2026-09-07: the combined-pair request either 504'd or
 * hung past the deploy plan's real function-duration cap (MF-CONTENT-GEN-VERCEL-504-0907).
 */
function dispatchPostTypeHops(req: Request, dateOverride: string | undefined, postTypes: ContentCalendarPostType[]) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return;
  const base = new URL(req.url);
  after(async () => {
    for (const postType of postTypes) {
      const hopUrl = new URL(base);
      hopUrl.searchParams.delete("secret");
      hopUrl.searchParams.set("postType", postType);
      if (dateOverride) hopUrl.searchParams.set("date", dateOverride);
      try {
        await fetch(hopUrl.toString(), { headers: { authorization: `Bearer ${secret}` } });
      } catch (e) {
        console.error(`[cron content-calendar-daily-generate] hop dispatch failed for ${postType}`, e);
      }
    }
  });
}

/**
 * Daily (weekday morning) Content Hub top-up — fills in whichever of today's JB-locked post-type
 * pair (CONTENT_CALENDAR_WEEKDAY_POST_TYPES) are still missing, with fresh trending-hashtag
 * research each run. See daily-generation.ts for why this exists alongside, not instead of, the
 * Monday weekly batch (content-calendar-weekly-generate).
 *
 * Chained by post type (see dispatchPostTypeHops / MF-CONTENT-GEN-VERCEL-504-0907): a plain
 * top-level request only does the cheap missing-type lookup, then hands each type off to its own
 * hop (`?postType=`) so the actual AI generation never shares this request's time budget.
 */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV22Schema();
    const url = new URL(req.url);
    const dateOverride = url.searchParams.get("date")?.trim() || undefined;
    const postType = url.searchParams.get("postType")?.trim() as ContentCalendarPostType | undefined;

    // Synchronous mode (?sync=1): run generation INLINE and return only after the posts are
    // written — no `after()` hop. Vercel's after-response background work is not guaranteed to
    // run to completion on this deploy plan (observed live 2026-09-07: hop acks returned 200 but
    // their deferred writes were lost), so a caller that must SEE the rows created — a manual
    // backfill / operator "generate this now" — uses this instead of the fire-and-forget hops.
    //
    // Combine with `?postType=X` to generate exactly ONE post inline. This is the reliable unit:
    // generateBulkContent produces ALL requested items before it writes any of them, so a full
    // 2-type day (~2×≈100s) overruns the 120s function budget and is killed before a single row
    // lands (observed live 2026-09-07: a 1-post day completed, a 2-fresh-post day wrote nothing).
    // One post at a time fits (cached hashtags per PR #369 + one ≈100s AI call), so an operator
    // fills a day with two `?sync=1&postType=` calls. Idempotent: a type already in the Hub is
    // skipped, so re-firing only generates what is missing.
    if (url.searchParams.get("sync") === "1") {
      const result = await runDailyContentGeneration({
        date: dateOverride,
        ...(postType ? { onlyPostType: postType } : {}),
      });
      return NextResponse.json({ ok: true, mode: "sync", onlyPostType: postType ?? null, result });
    }

    if (postType) {
      // Single-type hop: ack immediately, do the one bounded AI call + write in after().
      after(async () => {
        try {
          const result = await runDailyContentGeneration({ date: dateOverride, onlyPostType: postType });
          console.log("[cron content-calendar-daily-generate] hop complete", postType, result);
        } catch (e) {
          console.error("[cron content-calendar-daily-generate] hop failed", postType, e);
        }
      });
      return NextResponse.json({ ok: true, accepted: postType, date: dateOverride ?? null });
    }

    const slot = await getDailyMissingPostTypes(dateOverride ? { date: dateOverride } : undefined);
    if (!slot.ran || !slot.missingPostTypes.length) {
      return NextResponse.json({ ok: true, result: slot });
    }

    dispatchPostTypeHops(req, dateOverride, slot.missingPostTypes);
    return NextResponse.json({
      ok: true,
      dispatched: slot.missingPostTypes,
      weekStart: slot.weekStart,
      postDate: slot.postDate,
    });
  } catch (e) {
    console.error("[cron content-calendar-daily-generate]", e);
    return NextResponse.json({ error: "Daily content generation failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}

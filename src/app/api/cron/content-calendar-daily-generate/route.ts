import { NextResponse, after } from "next/server";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import { runDailyContentGeneration, getDailyMissingPostTypes } from "@/lib/content-calendar/daily-generation";
import type { ContentCalendarPostType } from "@/lib/content-calendar/constants";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

    // Synchronous mode (?sync=1): run the day's generation INLINE and return only after the
    // posts are written — no `after()` hop. Vercel's after-response background work is not
    // guaranteed to run to completion on this deploy plan (observed live 2026-09-07: hops acked
    // 200 but only 1 of 10 writes landed), so a caller that must SEE the rows created — a manual
    // backfill / operator "generate this day now" — uses this instead of the fire-and-forget
    // hop fan-out. Safe within the 120s budget now that hashtag research is cached
    // (MF-CONTENT-GEN-VERCEL-504-0907 / PR #369): cached hashtags + the day's ≤2 post AI calls.
    if (url.searchParams.get("sync") === "1") {
      const result = await runDailyContentGeneration(dateOverride ? { date: dateOverride } : undefined);
      return NextResponse.json({ ok: true, mode: "sync", result });
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

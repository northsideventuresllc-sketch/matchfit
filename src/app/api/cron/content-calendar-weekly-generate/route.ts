import { NextResponse, after } from "next/server";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import {
  planWeeklyGeneration,
  generateWeeklyDayPosts,
  type WeeklyDayPlan,
  type WeeklyPlanResult,
} from "@/lib/content-calendar/weekly-generation";
import type { HashtagResearchSnapshot } from "@/lib/content-calendar/hashtag-research";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

type DayHopPayload = {
  weekStart: string;
  dpmoPhase: string | null;
  socialScanSnapshotId: string;
  hashtags: HashtagResearchSnapshot;
  dayPlan: WeeklyDayPlan;
};

/**
 * Fans out one same-origin hop per weekday, each acking immediately and doing its real day's
 * generation in its own `after()` — so each day gets a fresh maxDuration budget instead of
 * sharing this invocation's. Proven live 2026-09-07: the sequential 5-day loop 504'd past the
 * deploy plan's real function-duration cap (MF-CONTENT-GEN-VERCEL-504-0907). The heavy shared
 * prep (social scan, hashtag research, week plan) still runs once, synchronously, before this —
 * it isn't what was observed timing out.
 */
function dispatchDayHops(req: Request, plan: WeeklyPlanResult) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return;
  const base = new URL(req.url);
  after(async () => {
    for (const dayPlan of plan.plan) {
      const hopUrl = new URL(base);
      hopUrl.searchParams.delete("secret");
      hopUrl.searchParams.delete("weekStart");
      const payload: DayHopPayload = {
        weekStart: plan.weekStart,
        dpmoPhase: plan.dpmoPhase,
        socialScanSnapshotId: plan.socialScanSnapshotId,
        hashtags: plan.hashtags,
        dayPlan,
      };
      hopUrl.searchParams.set("dayHop", JSON.stringify(payload));
      try {
        await fetch(hopUrl.toString(), { headers: { authorization: `Bearer ${secret}` } });
      } catch (e) {
        console.error(`[cron content-calendar-weekly-generate] hop dispatch failed for day ${dayPlan.dayIndex}`, e);
      }
    }
  });
}

/**
 * Monday 8am ET weekly content generation (5 days × 2 locked post types) into the Content Hub.
 *
 * Chained by day (see dispatchDayHops / MF-CONTENT-GEN-VERCEL-504-0907): a plain top-level
 * request runs the shared plan once (social scan + hashtag research + AI week-plan), then hands
 * each day off to its own hop (`?dayHop=`) so per-day AI generation never shares this request's
 * time budget with the other 4 days.
 */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV22Schema();
    const url = new URL(req.url);
    const dayHopRaw = url.searchParams.get("dayHop");

    if (dayHopRaw) {
      const payload = JSON.parse(dayHopRaw) as DayHopPayload;
      // Single-day hop: ack immediately, do the one bounded AI call + writes in after().
      after(async () => {
        try {
          const result = await generateWeeklyDayPosts(payload);
          console.log("[cron content-calendar-weekly-generate] hop complete", payload.dayPlan.dayIndex, result);
        } catch (e) {
          console.error("[cron content-calendar-weekly-generate] hop failed", payload.dayPlan.dayIndex, e);
        }
      });
      return NextResponse.json({ ok: true, accepted: payload.dayPlan.dayIndex });
    }

    // Optional override so this can be re-run for a specific week (e.g. manually seeding
    // ahead of the Monday schedule) without depending on getMondayOfWeek()'s "current week"
    // math, which returns an already-elapsed Monday if called Tue-Sun (2026-08-02 fix).
    const weekStartOverride = url.searchParams.get("weekStart")?.trim() || undefined;
    const plan = await planWeeklyGeneration(weekStartOverride ? { weekStart: weekStartOverride } : undefined);

    dispatchDayHops(req, plan);
    return NextResponse.json({
      ok: true,
      dispatched: plan.plan.map((d) => d.dayIndex),
      weekStart: plan.weekStart,
      hashtagCount: plan.hashtags.hashtags.length,
    });
  } catch (e) {
    console.error("[cron content-calendar-weekly-generate]", e);
    return NextResponse.json({ error: "Weekly content generation failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}

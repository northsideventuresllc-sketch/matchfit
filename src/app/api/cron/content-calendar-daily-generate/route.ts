import { NextResponse } from "next/server";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import { runDailyContentGeneration } from "@/lib/content-calendar/daily-generation";
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
 * Daily (weekday morning) Content Hub top-up — fills in whichever of today's four post types are
 * still missing, with fresh trending-hashtag research each run. See daily-generation.ts for why
 * this exists alongside, not instead of, the Monday weekly batch (content-calendar-weekly-generate).
 */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV22Schema();
    // Optional override for manual backfill/testing, same pattern as the weekly cron's ?weekStart=.
    const dateOverride = new URL(req.url).searchParams.get("date")?.trim() || undefined;
    const result = await runDailyContentGeneration(dateOverride ? { date: dateOverride } : undefined);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[cron content-calendar-daily-generate]", e);
    return NextResponse.json({ error: "Daily content generation failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}

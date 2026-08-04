import { NextResponse } from "next/server";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import { runWeeklyContentGeneration } from "@/lib/content-calendar/weekly-generation";
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

/** Monday 8am ET weekly content generation (5 days × 4 post types) into the Content Hub. */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV22Schema();
    // Optional override so this can be re-run for a specific week (e.g. manually seeding
    // ahead of the Monday schedule) without depending on getMondayOfWeek()'s "current week"
    // math, which returns an already-elapsed Monday if called Tue-Sun (2026-08-02 fix).
    const weekStartOverride = new URL(req.url).searchParams.get("weekStart")?.trim() || undefined;
    const result = await runWeeklyContentGeneration(weekStartOverride ? { weekStart: weekStartOverride } : undefined);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[cron content-calendar-weekly-generate]", e);
    return NextResponse.json({ error: "Weekly content generation failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}

import { NextResponse } from "next/server";
import { isCronSecretAuthorized } from "@/lib/require-cron-secret";
import { runContentResearchPass } from "@/lib/content-calendar/run-research-pass";
import { ensureContentCalendarV23Schema } from "@/lib/ensure-content-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(req: Request): boolean {
  return isCronSecretAuthorized(req);
}

/**
 * Daily Social Media Research run (trigger "scheduled"). Same pass the manual "Run" button fires,
 * so the research tab always has a fresh daily report and the findings feed the day's generations.
 * Scheduled by GitHub Actions (.github/workflows/match-fit-content-research-cron.yml).
 */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV23Schema();
    const run = await runContentResearchPass({ adminId: null, trigger: "scheduled" });
    return NextResponse.json({ ok: true, run });
  } catch (e) {
    console.error("[cron content-calendar-research]", e);
    return NextResponse.json({ error: "Scheduled social media research failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}

import { NextResponse } from "next/server";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { isEstWeekend } from "@/lib/outreach-lanes";
import { runOutreachNationwideFinder } from "@/lib/outreach-nationwide-finder";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

/**
 * 8am ET (Mon–Fri) lead finder: finds online / virtual coaches NATIONWIDE and leaves 5 Instagram
 * leads and 5 email leads, each with a draft message for JB to edit. No city, no polygon.
 *
 * Draft-only — nothing is approved and nothing is sent. Weekends are skipped (outreach reaches JB
 * Monday–Friday only); pass `?force=1` to run anyway for a manual test.
 */
async function runCron(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && isEstWeekend()) {
    return NextResponse.json({
      ok: true,
      skipped: "Weekend — new leads are only found Monday to Friday.",
    });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    const summary = await runOutreachNationwideFinder();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("[cron outreach-lead-finder]", e);
    return NextResponse.json({ error: "Lead finder failed." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return runCron(req);
}

export async function POST(req: Request) {
  return runCron(req);
}

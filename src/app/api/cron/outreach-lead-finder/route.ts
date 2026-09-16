import { NextResponse } from "next/server";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { isEstHour, isEstWeekend } from "@/lib/outreach-lanes";
import { runOutreachNationwideFinder } from "@/lib/outreach-nationwide-finder";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";
/**
 * ROOT CAUSE (BUILD-MF-LEADFINDER-8S-TIMEOUT-0914): this route never set its own function
 * duration, so it inherited the platform default — far shorter than the run actually needs.
 * A full run can do up to `MAX_SEARCHES_PER_LANE` SerpApi searches per lane (each with its own
 * 20s fetch timeout) plus, on the email lane, up to 3 page fetches per candidate (8s timeout
 * each) for `findContactEmail`, across two lanes with a refill pass — comfortably past any
 * single-digit-second budget on a normal day, which is why this cron "always" timed out and had
 * never written a single lead. Every other search/generation-heavy cron route in this repo
 * (e.g. `content-calendar-weekly-generate`) already sets this same 300s ceiling next to
 * `dynamic = "force-dynamic"` — this route was simply missing it.
 */
export const maxDuration = 300;

/**
 * Target America/New_York hour for the lead finder. The caller (currently
 * nv-vault `.github/workflows/mf-lead-finder-nationwide.yml`) is expected to fire this route at
 * BOTH 12:00 UTC and 13:00 UTC every weekday — one of those lands on 8am ET depending on
 * EDT/EST, the other is rejected below as an off-hour trigger. See `isEstHour` (OUT-LEAD-FINDER-DST-GUARD).
 */
const LEAD_FINDER_TARGET_ET_HOUR = 8;

/**
 * Accepts EITHER the Vercel `CRON_SECRET` (what GitHub Actions sends) or the DB-backed
 * `COWORK_POLL_SECRET` from `platform_secrets`, via `hasValidCoworkSecret` — the fallback
 * added in 2.9.1-beta so an operator can drive this without Vercel dashboard access.
 * Checking only `process.env.CRON_SECRET` makes a route unfireable by hand the moment the
 * env value and the stored copy drift apart.
 */
function authorize(req: Request): Promise<boolean> {
  return hasValidCoworkSecret(req);
}

/**
 * 8am ET (Mon–Fri) lead finder: finds online / virtual coaches NATIONWIDE and leaves 5 Instagram
 * leads and 5 email leads, each with a draft message for JB to edit. No city, no polygon.
 *
 * Draft-only — nothing is approved and nothing is sent. Weekends are skipped (outreach reaches JB
 * Monday–Friday only); pass `?force=1` to run anyway for a manual test.
 */
async function runCron(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = new Date();
  if (!force && isEstWeekend(now)) {
    return NextResponse.json({
      ok: true,
      skipped: "Weekend — new leads are only found Monday to Friday.",
    });
  }
  if (!force && !isEstHour(LEAD_FINDER_TARGET_ET_HOUR, now)) {
    return NextResponse.json({
      ok: true,
      skipped:
        `Off-hour trigger (dual-cron DST guard) — the lead finder only runs at ` +
        `${LEAD_FINDER_TARGET_ET_HOUR}am America/New_York; this fire landed outside that hour.`,
    });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    const summary = await runOutreachNationwideFinder(now);
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

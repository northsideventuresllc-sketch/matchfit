import { NextResponse } from "next/server";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { isEstHour, isEstWeekend } from "@/lib/outreach-lanes";
import { runOutreachNationwideFinder } from "@/lib/outreach-nationwide-finder";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";

/**
 * ROOT CAUSE FIX (2026-09-15, OUT-LEAD-FINDER-8S-TIMEOUT): this route was missing an explicit
 * `maxDuration`, unlike every other heavy cron route in this directory (content-calendar-*,
 * match-fit-tos-jobs all declare 300). Without one, the underlying Vercel function runs on the
 * platform's default execution limit — far too short for this route's real work: up to
 * `MAX_SEARCHES_PER_LANE` (2) SerpApi calls per lane (20s timeout each) plus, per email
 * candidate, up to 3 sequential page fetches (8s timeout each) in `findContactEmail`, across two
 * lanes with a refill loop. That's why leads were never written even though the DB-side caller
 * (NI-Brain pg_cron jobs `mf-cron-lead-finder-1`/`-2`, via `fn_mf_cron_ping`) already passes a
 * generous `p_timeout_ms` override of 290000 (290s) — `fn_mf_cron_ping`'s own default is 8000ms
 * (8s), which is the "always times out at 8s" symptom, but that default is already overridden at
 * the DB layer for both lead-finder jobs. The Vercel function itself was the still-unfixed half:
 * it had no execution budget to match, so Vercel killed it long before pg_net's 290s patience ran
 * out. 300s here matches the DB-side 290000ms override with the same ~10s safety margin every
 * other `fn_mf_cron_ping('…', '…', 290000)` caller in this repo already uses.
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

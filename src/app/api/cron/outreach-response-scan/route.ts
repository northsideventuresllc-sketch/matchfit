import { NextResponse } from "next/server";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";
import { scanOutreachEmailReplies } from "@/lib/outreach-email-scan";
import { createOutreachInstagramScanJob } from "@/lib/outreach-instagram-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Scheduled runs have no admin session — jobs/drafts are stamped with this sentinel owner. */
const CRON_ADMIN_ID = "system-cron";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

/**
 * Scheduled reply scan (WF2 item 2, JB 2026-09-03). Same work as the manual Pending Responses
 * "Scan for replies" button: email reply check inline (jb@match-fit.net via Microsoft Graph) plus
 * a queued Instagram Cowork scan job (@theofficialmatchfit) that a free Mac-mini session works and
 * posts replies back to the scan-job completion callback. Scheduled via NI-Brain pg_cron at
 * 9am/12pm/3pm/6pm ET M–F and 12pm ET Sat/Sun — the schedule owns the timing, so no hour guard.
 */
async function runCron(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    await ensureOutreachHubSchema();

    const email = await scanOutreachEmailReplies({ adminId: CRON_ADMIN_ID });
    const instagram = await createOutreachInstagramScanJob({ adminId: CRON_ADMIN_ID });

    return NextResponse.json({
      ok: true,
      email: { configured: email.configured, matched: email.matched.length },
      instagram: { jobId: instagram.jobId, candidateCount: instagram.candidateCount },
    });
  } catch (e) {
    console.error("[cron outreach-response-scan]", e);
    return NextResponse.json({ error: "Cron failed." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return runCron(req);
}

export async function POST(req: Request) {
  return runCron(req);
}

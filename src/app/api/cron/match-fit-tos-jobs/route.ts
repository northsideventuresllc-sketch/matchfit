import { NextResponse } from "next/server";
import { isCronSecretAuthorized } from "@/lib/require-cron-secret";
import { runMatchFitTosCronJobs } from "@/lib/match-fit-tos-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(req: Request): boolean {
  return isCronSecretAuthorized(req);
}

async function runCron(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const summary = await runMatchFitTosCronJobs();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("[cron match-fit-tos-jobs]", e);
    return NextResponse.json({ error: "Cron failed." }, { status: 500 });
  }
}

/** Vercel Cron invokes GET; manual ops may use POST with the same Bearer secret. */
export async function GET(req: Request) {
  return runCron(req);
}

/** Scheduled jobs: background-check renewal, session auto-complete, DIY alerts, beta waitlist
 *  promotion, abandoned-signup follow-up emails. */
export async function POST(req: Request) {
  return runCron(req);
}

import { NextResponse } from "next/server";
import { ensureContentCalendarV22Schema } from "@/lib/ensure-content-hub-schema";
import { getPendingCoworkJobs, updateCoworkJobStatus } from "@/lib/content-calendar/cowork-jobs";
import { hydratePlatformEnvFromDatabase } from "@/lib/hydrate-platform-env";

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
 * 5pm & 8pm ET (M-F) dispatcher: stamps any queued post_batch Cowork job as dispatched so the
 * external Cowork poller reliably sees what is ready. Idempotent — already-dispatched jobs are
 * left alone.
 */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    await hydratePlatformEnvFromDatabase();
    await ensureContentCalendarV22Schema();
    const jobs = await getPendingCoworkJobs("post_batch");
    const dispatched: string[] = [];
    for (const job of jobs) {
      await updateCoworkJobStatus({ jobId: job.id, status: "dispatched" });
      dispatched.push(job.id);
    }
    return NextResponse.json({ ok: true, dispatched, count: dispatched.length });
  } catch (e) {
    console.error("[cron content-calendar-post-batch]", e);
    return NextResponse.json({ error: "Post batch dispatch failed." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}

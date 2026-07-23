import { NextResponse } from "next/server";
import { getPendingCoworkJobs } from "@/lib/content-calendar/cowork-jobs";
import {
  ensureContentCalendarV22Schema,
  isMissingContentCalendarV22SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";

export const dynamic = "force-dynamic";

/** The external Cowork session polls this with the shared CRON_SECRET (no admin cookie). */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

/**
 * GET /api/admin/content-calendar/v2/cowork-jobs?jobType=generate_media|post_batch
 *
 * Lists queued/dispatched Cowork jobs (with their full brief) for an external Cowork
 * Desktop-Control session to pick up. Omit jobType to return both kinds.
 */
export async function GET(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const jobTypeParam = new URL(req.url).searchParams.get("jobType");
  const jobType =
    jobTypeParam === "generate_media" || jobTypeParam === "post_batch" ? jobTypeParam : undefined;

  try {
    await ensureContentCalendarV22Schema();
    const jobs = await getPendingCoworkJobs(jobType);
    return NextResponse.json({ jobs });
  } catch (e) {
    console.error("[content-calendar cowork-jobs GET]", e);
    if (isMissingContentCalendarV22SchemaError(e)) {
      return NextResponse.json({ error: "Content calendar schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load cowork jobs." }, { status: 500 });
  }
}

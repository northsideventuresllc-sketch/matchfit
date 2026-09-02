import { NextResponse } from "next/server";
import { getPendingMediaAgentJobs } from "@/lib/content-calendar/cowork-jobs";
import {
  ensureContentCalendarV22Schema,
  isMissingContentCalendarV22SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/content-calendar/v2/media-agent-jobs?jobType=generate_media|post_batch
 *
 * Lists queued/dispatched media-agent jobs (with their full brief) for the Mac-mini job-queue
 * runner (nvg_mini_jobs) to pick up and hand to scripts/gemini-media-automation.mjs. Omit
 * jobType to return both kinds.
 */
export async function GET(req: Request) {
  if (!(await hasValidCoworkSecret(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const jobTypeParam = new URL(req.url).searchParams.get("jobType");
  const jobType =
    jobTypeParam === "generate_media" || jobTypeParam === "post_batch" ? jobTypeParam : undefined;

  try {
    await ensureContentCalendarV22Schema();
    const jobs = await getPendingMediaAgentJobs(jobType);
    return NextResponse.json({ jobs });
  } catch (e) {
    console.error("[content-calendar media-agent-jobs GET]", e);
    if (isMissingContentCalendarV22SchemaError(e)) {
      return NextResponse.json({ error: "Content calendar schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load media agent jobs." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getMediaPipelineHealth } from "@/lib/content-calendar/media-pipeline-health";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/content-calendar/v2/pipeline-health
 *
 * Small poll the Pending/Publishing tabs use to show a plain-English banner when the Mac mini
 * media agent is offline or media jobs are parked — so a build/post that isn't moving explains
 * itself instead of hanging (JB 2026-09-03: "nothing has gone out this week").
 */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!(await isNiBrainConfiguredAsync())) {
    // Not a blocker to surface loudly — the tabs just skip the banner.
    return NextResponse.json({
      health: { status: "ok", message: "", miniOnline: true, miniLastSeenIso: null, miniAgeMinutes: null, stuckMediaJobs: 0 },
    });
  }

  try {
    const health = await getMediaPipelineHealth();
    return NextResponse.json({ health });
  } catch (e) {
    console.error("[content-calendar pipeline-health]", e);
    // Never turn a health-check hiccup into a scary banner.
    return NextResponse.json({
      health: { status: "ok", message: "", miniOnline: true, miniLastSeenIso: null, miniAgeMinutes: null, stuckMediaJobs: 0 },
    });
  }
}

import { NextResponse } from "next/server";
import { fetchRecentAxonMatchFitFindings } from "@/lib/content-calendar/content-research-store";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/content-calendar/v2/research/axon-findings
 *
 * Recent Match Fit findings from AXON's daily Social Media Research agent, so the research tab shows
 * what AXON found (JB: "I need to see the findings and it is not there right now").
 */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ findings: [] });
  }
  try {
    const findings = await fetchRecentAxonMatchFitFindings(5);
    return NextResponse.json({ findings });
  } catch (e) {
    console.error("[content-calendar v2 research axon-findings]", e);
    return NextResponse.json({ findings: [] });
  }
}

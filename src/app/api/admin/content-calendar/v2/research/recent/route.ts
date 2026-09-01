import { NextResponse } from "next/server";
import { listRecentResearchRuns, serializeResearchRun } from "@/lib/content-calendar/content-research-store";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

/** Most recent completed research runs — the Social Media Research tab's "recent" strip. */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  try {
    await ensureContentCalendarV23Schema();
    const runs = await listRecentResearchRuns();
    return NextResponse.json({ runs: runs.map(serializeResearchRun) });
  } catch (e) {
    console.error("[content-calendar v2 research recent]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load recent research runs.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { listResearchRunArchiveMonths } from "@/lib/content-calendar/content-research-store";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

/** Distinct year/month buckets with at least one completed research run — the archive picker. */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  try {
    await ensureContentCalendarV23Schema();
    const months = await listResearchRunArchiveMonths();
    return NextResponse.json({ months });
  } catch (e) {
    console.error("[content-calendar v2 research archive months]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load the research archive months.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

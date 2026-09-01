import { NextResponse } from "next/server";
import { listResearchRunsForDate, serializeResearchRun } from "@/lib/content-calendar/content-research-store";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

/** Every research run for one exact ET calendar date (YYYY-MM-DD), newest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ date: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid research date." }, { status: 400 });
  }

  try {
    await ensureContentCalendarV23Schema();
    const runs = await listResearchRunsForDate(date);
    return NextResponse.json({ runs: runs.map(serializeResearchRun) });
  } catch (e) {
    console.error("[content-calendar v2 research archive date]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load that day's research runs.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

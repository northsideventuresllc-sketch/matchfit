import { NextResponse } from "next/server";
import { listResearchRunsForMonth, serializeResearchRun } from "@/lib/content-calendar/content-research-store";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

/** Every research run in one ET calendar month (1-12), newest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ year: string; month: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const { year: yearRaw, month: monthRaw } = await ctx.params;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid archive month." }, { status: 400 });
  }

  try {
    await ensureContentCalendarV23Schema();
    const runs = await listResearchRunsForMonth(year, month);
    return NextResponse.json({ runs: runs.map(serializeResearchRun) });
  } catch (e) {
    console.error("[content-calendar v2 research archive month]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load that month's research runs.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

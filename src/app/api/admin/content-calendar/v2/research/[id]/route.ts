import { NextResponse } from "next/server";
import { getResearchRun, serializeResearchRun } from "@/lib/content-calendar/content-research-store";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

/** One research run by id — used by the inline modal viewer (the standalone tab page reads the store directly). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const { id } = await ctx.params;

  try {
    await ensureContentCalendarV23Schema();
    const run = await getResearchRun(id);
    if (!run) return NextResponse.json({ error: "Research run not found." }, { status: 404 });
    return NextResponse.json({ run: serializeResearchRun(run) });
  } catch (e) {
    console.error("[content-calendar v2 research get]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load that research run.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

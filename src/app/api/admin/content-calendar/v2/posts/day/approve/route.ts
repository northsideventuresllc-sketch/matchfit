import { NextResponse } from "next/server";
import { z } from "zod";
import {
  approveContentDay,
  returnContentDayToEditing,
} from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import {
  ensureContentCalendarV22Schema,
  isMissingContentCalendarV22SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  action: z.enum(["approve", "return_to_editing"]).default("approve"),
  postDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid day approval request." }, { status: 400 });

  try {
    await ensureContentCalendarV22Schema();
    if (parsed.data.action === "return_to_editing") {
      const result = await returnContentDayToEditing(parsed.data.postDate);
      return NextResponse.json({ ok: true, ...result });
    }
    const result = await approveContentDay(parsed.data.postDate);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[content-calendar v2 day approve]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not approve content day.") },
      { status: isMissingContentCalendarV22SchemaError(e) ? 503 : 500 },
    );
  }
}

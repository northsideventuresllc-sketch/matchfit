import { NextResponse } from "next/server";
import { z } from "zod";
import { submitApprovedV2Posts } from "@/lib/content-calendar/content-calendar-v2-store";
import { ensureContentCalendarV2Schema, isMissingContentCalendarV2SchemaError } from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit_approved"),
    lane: z.enum(["scheduled", "impromptu"]),
    postDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
]);

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid v2 bulk action." }, { status: 400 });

  try {
    await ensureContentCalendarV2Schema();
    const moved = await submitApprovedV2Posts({
      lane: parsed.data.lane,
      postDate: parsed.data.postDate,
    });
    return NextResponse.json({ moved });
  } catch (e) {
    console.error("[content-calendar v2 bulk action]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Content calendar v2 bulk action failed.") },
      { status: isMissingContentCalendarV2SchemaError(e) ? 503 : 500 },
    );
  }
}

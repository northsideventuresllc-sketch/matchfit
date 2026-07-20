import { NextResponse } from "next/server";
import { z } from "zod";
import { getContentCalendarAiStatusAsync } from "@/lib/content-calendar/content-calendar-ai";
import { CONTENT_CALENDAR_POST_TYPES } from "@/lib/content-calendar/constants";
import { generateWeeklyPlannerDay, serializeV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { ensureContentCalendarV2Schema, isMissingContentCalendarV2SchemaError } from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayIndex: z.number().int().min(0).max(4),
  theme: z.string().min(1).max(500),
  targetAudience: z.string().min(1).max(120),
  cta: z.string().min(1).max(500),
  prompts: z.record(z.enum(CONTENT_CALENDAR_POST_TYPES), z.string().min(1).max(2000)),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const ai = await getContentCalendarAiStatusAsync();
  if (!ai.configured) {
    return NextResponse.json({ error: ai.message }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid weekly planner day." }, { status: 400 });

  try {
    await ensureContentCalendarV2Schema();
    const rows = await generateWeeklyPlannerDay({
      ...parsed.data,
      adminId: sess.adminId,
    });
    return NextResponse.json({ posts: rows.map(serializeV2Post), total: rows.length });
  } catch (e) {
    console.error("[content-calendar v2 weekly]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not approve weekly planner day.") },
      { status: isMissingContentCalendarV2SchemaError(e) ? 503 : 500 },
    );
  }
}

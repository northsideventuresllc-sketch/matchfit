import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBulkContent } from "@/lib/content-calendar/content-calendar-ai";
import {
  CONTENT_CALENDAR_BULK_MAX_COUNT,
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_POST_TYPES,
} from "@/lib/content-calendar/constants";
import { getContentCalendarAiStatusAsync } from "@/lib/content-calendar/content-calendar-ai";
import { requireAdminSession } from "@/lib/require-admin";

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        postType: z.enum(CONTENT_CALENDAR_POST_TYPES),
        targetGroup: z.enum(CONTENT_CALENDAR_GROUPS),
      }),
    )
    .min(1)
    .max(CONTENT_CALENDAR_BULK_MAX_COUNT),
  scheduled: z.boolean(),
  customPrompt: z.string().max(2000).optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const ai = await getContentCalendarAiStatusAsync();
  if (!ai.configured) {
    return NextResponse.json({ error: ai.message }, { status: 503 });
  }

  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const drafts = await generateBulkContent(parsed.data);
    return NextResponse.json({
      drafts,
      bulkSessionId: `bulk_${Date.now()}_${sess.adminId}`,
      maxCount: CONTENT_CALENDAR_BULK_MAX_COUNT,
    });
  } catch (e) {
    console.error("[content-calendar bulk-generate]", e);
    return NextResponse.json({ error: "Bulk generation failed." }, { status: 500 });
  }
}

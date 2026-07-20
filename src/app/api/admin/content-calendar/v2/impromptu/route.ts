import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBulkContent, getContentCalendarAiStatusAsync } from "@/lib/content-calendar/content-calendar-ai";
import {
  CONTENT_CALENDAR_BULK_MAX_COUNT,
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_POST_TYPES,
} from "@/lib/content-calendar/constants";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        postType: z.enum(CONTENT_CALENDAR_POST_TYPES),
        targetGroup: z.enum(CONTENT_CALENDAR_GROUPS),
        indexWithinType: z.number().int().min(1).max(CONTENT_CALENDAR_BULK_MAX_COUNT).optional(),
      }),
    )
    .min(1)
    .max(CONTENT_CALENDAR_BULK_MAX_COUNT),
  customPrompt: z.string().max(10000).optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const ai = await getContentCalendarAiStatusAsync();
  if (!ai.configured) {
    return NextResponse.json({ error: ai.message }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid impromptu generation request." }, { status: 400 });

  try {
    const { drafts, meta } = await generateBulkContent({
      items: parsed.data.items,
      scheduled: false,
      customPrompt: parsed.data.customPrompt,
      weekStart: parsed.data.weekStart,
    });
    return NextResponse.json({
      drafts,
      generationMeta: meta,
      bulkSessionId: `v2_impromptu_${Date.now()}_${sess.adminId}`,
    });
  } catch (e) {
    console.error("[content-calendar v2 impromptu]", e);
    return NextResponse.json({ error: "Impromptu generation failed." }, { status: 500 });
  }
}

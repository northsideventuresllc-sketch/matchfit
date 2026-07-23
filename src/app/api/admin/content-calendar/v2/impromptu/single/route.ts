import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBulkContent, getContentCalendarAiStatusAsync } from "@/lib/content-calendar/content-calendar-ai";
import {
  CONTENT_CALENDAR_GROUPS,
  CONTENT_CALENDAR_POST_TYPES,
  type ContentCalendarPostType,
} from "@/lib/content-calendar/constants";
import { buildMediaGenerationPrompt, type MediaPostType } from "@/lib/content-calendar/content-prompts";
import { createV2Draft, serializeV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { normalizeTargetGroup } from "@/lib/content-calendar/content-rules";
import { formatCalendarDate, getMondayOfWeek } from "@/lib/content-calendar/rotation";
import {
  ensureContentCalendarV22Schema,
  isMissingContentCalendarV22SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  postType: z.enum(CONTENT_CALENDAR_POST_TYPES),
  targetAudience: z.enum(CONTENT_CALENDAR_GROUPS),
  operatorPrompt: z.string().max(10000).optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Generates exactly ONE impromptu draft into the Content Hub, tagged content_lane='impromptu'. */
export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const ai = await getContentCalendarAiStatusAsync();
  if (!ai.configured) return NextResponse.json({ error: ai.message }, { status: 503 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid impromptu post request." }, { status: 400 });

  const postType = parsed.data.postType as ContentCalendarPostType;
  const targetAudience = normalizeTargetGroup(parsed.data.targetAudience);
  const weekStart = parsed.data.weekStart ?? formatCalendarDate(getMondayOfWeek());

  try {
    await ensureContentCalendarV22Schema();
    const { drafts, meta } = await generateBulkContent({
      items: [{ postType, targetGroup: targetAudience }],
      scheduled: false,
      customPrompt: parsed.data.operatorPrompt,
      weekStart,
    });
    const draft = drafts[0];
    if (!draft) {
      return NextResponse.json({ error: meta.lastError ?? "Impromptu generation returned no draft." }, { status: 502 });
    }

    const visualPrompt =
      postType === "Text"
        ? null
        : buildMediaGenerationPrompt({
            postType: postType as MediaPostType,
            visualPrompt: draft.visualPrompt,
            caption: draft.caption,
            targetGroup: targetAudience,
          });

    const row = await createV2Draft({
      draft: { ...draft, postType, visualPrompt },
      weekStart,
      lane: "impromptu",
      adminId: sess.adminId,
      generateMedia: false,
    });
    return NextResponse.json({ post: serializeV2Post(row), generationMeta: meta });
  } catch (e) {
    console.error("[content-calendar v2 impromptu single]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Impromptu generation failed.") },
      { status: isMissingContentCalendarV22SchemaError(e) ? 503 : 500 },
    );
  }
}

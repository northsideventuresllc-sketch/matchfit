import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CONTENT_CALENDAR_MAX_HASHTAGS,
  enforceGeneratedPostContent,
  normalizeHashtags,
} from "@/lib/content-calendar/content-rules";
import { updatePostFields } from "@/lib/content-calendar/content-calendar-store";
import { isNiBrainConfiguredAsync, recordContentLearning } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

const patchSchema = z.object({
  caption: z.string().max(8000).optional(),
  visualPrompt: z.string().max(8000).nullable().optional(),
  hashtags: z.array(z.string().max(100)).max(CONTENT_CALENDAR_MAX_HASHTAGS).optional(),
  originalCaption: z.string().optional(),
  originalVisualPrompt: z.string().nullable().optional(),
  originalHashtags: z.array(z.string()).optional(),
});

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const { deletePost } = await import("@/lib/content-calendar/content-calendar-store");

  try {
    await deletePost(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[content-calendar post DELETE]", e);
    return NextResponse.json({ error: "Could not delete post." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const data = parsed.data;
    const hasUpdates =
      data.caption !== undefined || data.visualPrompt !== undefined || data.hashtags !== undefined;
    if (!hasUpdates) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    let caption = data.caption;
    let hashtags = data.hashtags !== undefined ? normalizeHashtags(data.hashtags) : undefined;
    if (caption !== undefined || hashtags !== undefined) {
      const enforced = enforceGeneratedPostContent({
        caption: caption ?? data.originalCaption ?? "",
        hashtags: hashtags ?? normalizeHashtags(data.originalHashtags),
      });
      if (caption !== undefined) caption = enforced.caption;
      if (hashtags !== undefined || data.hashtags !== undefined) hashtags = enforced.hashtags;
    }

    await updatePostFields({
      postId: id,
      caption,
      visualPrompt: data.visualPrompt,
      hashtags,
    });

    if (
      data.originalCaption !== undefined &&
      caption !== undefined &&
      data.originalCaption.trim() !== caption.trim()
    ) {
      await recordContentLearning({
        signalType: "EDIT_DIFF",
        postId: id,
        originalText: data.originalCaption,
        editedText: caption,
        meta: { field: "caption" },
      });
    }
    if (
      data.visualPrompt !== undefined &&
      data.originalVisualPrompt !== undefined &&
      (data.originalVisualPrompt ?? "").trim() !== (data.visualPrompt ?? "").trim()
    ) {
      await recordContentLearning({
        signalType: "EDIT_DIFF",
        postId: id,
        originalText: data.originalVisualPrompt ?? "",
        editedText: data.visualPrompt ?? "",
        meta: { field: "visualPrompt" },
      });
    }
    if (data.originalHashtags !== undefined && hashtags !== undefined) {
      const orig = normalizeHashtags(data.originalHashtags).join(",");
      const next = hashtags.join(",");
      if (orig !== next) {
        await recordContentLearning({
          signalType: "EDIT_DIFF",
          postId: id,
          originalText: data.originalHashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
          editedText: hashtags.map((h) => `#${h}`).join(" "),
          meta: { field: "hashtags" },
        });
      }
    }

    return NextResponse.json({ ok: true, caption, visualPrompt: data.visualPrompt, hashtags });
  } catch (e) {
    console.error("[content-calendar post PATCH]", e);
    return NextResponse.json({ error: "Could not save post." }, { status: 500 });
  }
}

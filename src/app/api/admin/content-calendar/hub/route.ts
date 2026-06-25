import { NextResponse } from "next/server";
import { z } from "zod";
import type { BulkGeneratedDraft } from "@/lib/content-calendar/content-calendar-ai";
import { loadDeletedHubPosts, loadHubPosts, loadScheduledPosts, serializePostForClient } from "@/lib/content-calendar/content-calendar-store";
import { ensureContentHubSchema, isMissingContentHubSchemaError } from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync, recordContentLearning } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const view = new URL(req.url).searchParams.get("view") ?? "hub";

  try {
    await ensureContentHubSchema();
    if (view === "scheduled") {
      const posts = await loadScheduledPosts();
      return NextResponse.json({ posts: posts.map(serializePostForClient) });
    }
    if (view === "deleted") {
      const posts = await loadDeletedHubPosts();
      return NextResponse.json({ posts: posts.map(serializePostForClient), total: posts.length });
    }
    const posts = await loadHubPosts();
    return NextResponse.json({ posts: posts.map(serializePostForClient), total: posts.length });
  } catch (e) {
    console.error("[content-calendar hub GET]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load content hub.") },
      { status: isMissingContentHubSchemaError(e) ? 503 : 500 },
    );
  }
}

const saveSchema = z.object({
  draft: z.object({
    tempId: z.string(),
    dayIndex: z.number().int().min(0).max(99),
    postType: z.enum(["Carousel", "Static", "Video", "Text"]),
    targetGroup: z.string().min(1),
    platforms: z.string().min(1),
    caption: z.string(),
    visualPrompt: z.string().nullable().optional().default(null),
    hashtags: z.array(z.string()).default([]),
    postDate: z.string().nullable().optional().default(null),
  }),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled: z.boolean(),
  bulkSessionId: z.string().min(1),
  originalCaption: z.string().optional(),
  originalVisualPrompt: z.string().nullable().optional(),
  originalHashtags: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatUserFacingError(parsed.error.flatten(), "Invalid request.") },
      { status: 400 },
    );
  }

  try {
    await ensureContentHubSchema();
    const { saveDraftToHub } = await import("@/lib/content-calendar/content-calendar-store");
    const row = await saveDraftToHub({
      draft: parsed.data.draft as BulkGeneratedDraft,
      weekStart: parsed.data.weekStart,
      scheduled: parsed.data.scheduled,
      adminId: sess.adminId,
      bulkSessionId: parsed.data.bulkSessionId,
    });

    const { originalCaption, originalVisualPrompt, originalHashtags } = parsed.data;
    if (
      originalCaption !== undefined &&
      originalCaption.trim() !== parsed.data.draft.caption.trim()
    ) {
      await recordContentLearning({
        signalType: "EDIT_DIFF",
        postId: row.id,
        originalText: originalCaption,
        editedText: parsed.data.draft.caption,
        meta: { field: "caption", source: "hub_save" },
      });
    }
    if (
      originalVisualPrompt !== undefined &&
      (originalVisualPrompt ?? "").trim() !== (parsed.data.draft.visualPrompt ?? "").trim()
    ) {
      await recordContentLearning({
        signalType: "EDIT_DIFF",
        postId: row.id,
        originalText: originalVisualPrompt ?? "",
        editedText: parsed.data.draft.visualPrompt ?? "",
        meta: { field: "visualPrompt", source: "hub_save" },
      });
    }
    if (originalHashtags !== undefined) {
      const orig = originalHashtags.map((h) => h.replace(/^#/, "")).join(",");
      const next = (parsed.data.draft.hashtags ?? []).map((h) => h.replace(/^#/, "")).join(",");
      if (orig !== next) {
        await recordContentLearning({
          signalType: "EDIT_DIFF",
          postId: row.id,
          originalText: originalHashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
          editedText: (parsed.data.draft.hashtags ?? []).map((h) => `#${h.replace(/^#/, "")}`).join(" "),
          meta: { field: "hashtags", source: "hub_save" },
        });
      }
    }

    return NextResponse.json({ post: serializePostForClient(row) });
  } catch (e) {
    console.error("[content-calendar hub POST]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not save to content hub.") },
      { status: isMissingContentHubSchemaError(e) ? 503 : 500 },
    );
  }
}

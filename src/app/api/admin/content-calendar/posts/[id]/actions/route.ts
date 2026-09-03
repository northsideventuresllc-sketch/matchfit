import { NextResponse } from "next/server";
import { z } from "zod";
import { regenerateCalendarPost } from "@/lib/content-calendar/content-calendar-ai";
import {
  dismissMissedPrompt,
  markPostPosted,
  reschedulePost,
  restoreDeletedPost,
  serializePostForClient,
  upsertWeekPosts,
  updateHubPostDate,
} from "@/lib/content-calendar/content-calendar-store";
import type { ContentCalendarPostType } from "@/lib/content-calendar/constants";
import { isNiBrainConfiguredAsync, recordContentLearning } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

// generate_media now just queues the Mac mini agent (fireMediaAgentForPost) and returns — kept
// at 300s to match the cron route's budget for the other actions here (e.g. AI regenerate).
export const maxDuration = 300;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("posted") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("dismiss_missed") }),
  z.object({
    action: z.literal("reschedule"),
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal("generate_media"),
    prompt: z.string().min(10).max(4000),
  }),
  z.object({
    action: z.literal("update_post_date"),
    postDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal("regenerate"),
    feedback: z.string().max(2000).optional(),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    offset: z.number().int().min(0).max(28),
    dayIndex: z.number().int().min(0).max(4),
    postType: z.enum(["Carousel", "Static", "Video", "Text"]),
    existingCaption: z.string().optional(),
    existingVisualPrompt: z.string().nullable().optional(),
  }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const { id } = await ctx.params;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  try {
    switch (parsed.data.action) {
      case "posted":
        await markPostPosted(id);
        await recordContentLearning({ signalType: "POSTED", postId: id, meta: { postedAt: new Date().toISOString() } });
        return NextResponse.json({ ok: true });
      case "restore":
        await restoreDeletedPost(id);
        return NextResponse.json({ ok: true });
      case "update_post_date":
        await updateHubPostDate({ postId: id, postDate: parsed.data.postDate });
        return NextResponse.json({ ok: true });
      case "dismiss_missed":
        await dismissMissedPrompt(id);
        return NextResponse.json({ ok: true });
      case "reschedule":
        await reschedulePost({ postId: id, newDate: parsed.data.newDate });
        return NextResponse.json({ ok: true });
      case "regenerate": {
        const {
          weekStart,
          offset,
          dayIndex,
          postType,
          feedback,
          existingCaption,
          existingVisualPrompt,
        } = parsed.data;
        const regenerated = await regenerateCalendarPost({
          weekStart,
          offset,
          dayIndex,
          postType: postType as ContentCalendarPostType,
          feedback,
          existingCaption,
          existingVisualPrompt,
        });
        if (!regenerated) {
          return NextResponse.json({ error: "Regeneration failed. Check AI API keys." }, { status: 502 });
        }
        const rows = await upsertWeekPosts({
          weekStart,
          offset,
          posts: [regenerated],
          adminId: sess.adminId,
        });
        const post = rows.find(
          (r) => r.day_index === dayIndex && r.post_type === postType,
        );
        return NextResponse.json({ post: post ? serializePostForClient(post) : null });
      }
      case "generate_media": {
        // Corrected 2026-09-03 (Decision #1722 item 4, lane D2): this used to call
        // generateStaticMedia() directly against a Gemini image API key with zero free
        // quota — every call failed. Media is generated in Chrome on the Mac mini (JB's own
        // Gemini subscription), so this routes through the same fireMediaAgentForPost() path
        // Approve Day / Regenerate already use: it stamps the operator's prompt in as
        // feedback, sets media_status "generating", and queues the real producer
        // (queueMiniChromeAgentJob -> scripts/gemini-media-automation.mjs on the mini). The
        // mini writes the finished media_url back onto the post itself when it's done.
        const { fireMediaAgentForPost } = await import("@/lib/content-calendar/content-calendar-cowork-orchestration");
        try {
          await fireMediaAgentForPost(id, { feedback: parsed.data.prompt });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Could not queue media generation.";
          return NextResponse.json({ error: message }, { status: 502 });
        }
        await recordContentLearning({
          signalType: "MEDIA_GENERATED",
          postId: id,
          meta: { prompt: parsed.data.prompt.slice(0, 500), queuedToMini: true },
        });
        return NextResponse.json({ ok: true, queued: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    console.error("[content-calendar post action]", e);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}

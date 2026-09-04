import { NextResponse } from "next/server";
import { z } from "zod";
import { fireMediaAgentForPost } from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import {
  approveV2Post,
  approveV2PostForPublishing,
  archiveV2Post,
  cancelV2ScheduledPost,
  getV2Post,
  manuallyPostV2Post,
  manuallyRedoV2PostMedia,
  markV2PostPosted,
  markV2PostUnposted,
  moveV2PostToDrafts,
  regenerateV2PostMedia,
  removeV2PostMedia,
  reviveV2Post,
  runV2OptimizationJob,
  scheduleV2Post,
  sendV2PostBackToPublishing,
  serializeV2Post,
  startV2Optimization,
} from "@/lib/content-calendar/content-calendar-v2-store";
import {
  ensureContentCalendarV24Schema,
  isMissingContentCalendarV24SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { createNiBrainClient, isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("adjust_media") }),
  z.object({ action: z.literal("back_to_drafts") }),
  z.object({ action: z.literal("archive"), scrapReason: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("revive") }),
  z.object({ action: z.literal("cancel_scheduled") }),
  z.object({
    action: z.literal("optimize"),
    platforms: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    action: z.literal("schedule"),
    scheduledAt: z.string().min(1),
  }),
  // Manual media replacement (Lane 3) — JB uploaded new media directly instead of regenerating it.
  z.object({
    action: z.literal("manual_redo_media"),
    mediaUrls: z.array(z.string().min(1)).min(1),
  }),
  // Single-post agent regenerate/redo — stage-agnostic (works from "hub" or "publishing"), always
  // lands the post in "pending" to await the next media-build slot.
  z.object({
    action: z.literal("regenerate_via_agent"),
    feedback: z.string().max(2000).optional(),
  }),
  // Manual-vs-agent posting: JB posts this himself, so it moves to Scheduled awaiting a POSTED confirm.
  z.object({ action: z.literal("manual_post") }),
  // Scheduled tab: confirm the manually-posted post actually went out (POSTED), or undo that.
  z.object({ action: z.literal("mark_posted") }),
  z.object({ action: z.literal("mark_unposted") }),
  // Scheduled tab: send a scheduled post back to Publishing.
  z.object({ action: z.literal("back_to_publishing") }),
  // Publishing tab: remove the current media (leaves the post in place to re-upload/regenerate).
  z.object({ action: z.literal("remove_media") }),
  // Pending manual-prompt flow: operator uploaded media, approve it straight to Publishing.
  z.object({
    action: z.literal("approve_for_publishing"),
    mediaUrls: z.array(z.string().min(1)).optional(),
  }),
  // Impromptu-only: Text posts have nothing to build and go straight to Publishing; every other
  // post type fires a single-post Cowork media job and lands in Pending.
  z.object({ action: z.literal("submit_for_generation") }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid v2 post action." }, { status: 400 });
  const { id } = await ctx.params;

  try {
    await ensureContentCalendarV24Schema();
    switch (parsed.data.action) {
      case "approve":
        await approveV2Post(id);
        break;
      case "adjust_media": {
        const row = await regenerateV2PostMedia(id);
        return NextResponse.json({ post: serializeV2Post(row) });
      }
      case "back_to_drafts":
        await moveV2PostToDrafts(id);
        break;
      case "archive":
        await archiveV2Post(id, { scrapReason: parsed.data.scrapReason ?? null });
        break;
      case "revive":
        await reviveV2Post(id);
        break;
      case "cancel_scheduled":
        await cancelV2ScheduledPost(id);
        break;
      case "optimize":
        await startV2Optimization({ postId: id, platforms: parsed.data.platforms });
        void runV2OptimizationJob(id);
        break;
      case "schedule":
        await scheduleV2Post({ postId: id, scheduledAt: parsed.data.scheduledAt });
        break;
      case "manual_redo_media": {
        const row = await manuallyRedoV2PostMedia(id, { mediaUrls: parsed.data.mediaUrls });
        return NextResponse.json({ post: serializeV2Post(row) });
      }
      case "regenerate_via_agent": {
        const { job, post } = await fireMediaAgentForPost(id, { feedback: parsed.data.feedback });
        return NextResponse.json({ post: serializeV2Post(post), jobId: job.id });
      }
      case "manual_post": {
        const row = await manuallyPostV2Post(id);
        return NextResponse.json({ post: serializeV2Post(row) });
      }
      case "mark_posted": {
        const row = await markV2PostPosted(id);
        return NextResponse.json({ post: serializeV2Post(row) });
      }
      case "mark_unposted": {
        const row = await markV2PostUnposted(id);
        return NextResponse.json({ post: serializeV2Post(row) });
      }
      case "back_to_publishing": {
        const row = await sendV2PostBackToPublishing(id);
        return NextResponse.json({ post: serializeV2Post(row) });
      }
      case "remove_media": {
        const row = await removeV2PostMedia(id);
        return NextResponse.json({ post: serializeV2Post(row) });
      }
      case "approve_for_publishing": {
        const row = await approveV2PostForPublishing(id, { mediaUrls: parsed.data.mediaUrls });
        return NextResponse.json({ post: serializeV2Post(row) });
      }
      case "submit_for_generation": {
        const post = await getV2Post(id);
        if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

        if (post.post_type === "Text") {
          // Nothing to build — patch straight to Publishing. No store helper does this bare
          // single-post transition outside the day-batch/job-completion paths (content-calendar-v2-store.ts
          // and content-calendar-cowork-orchestration.ts are Phase A1's files, out of scope here), so
          // this mirrors their exact patch shape directly rather than adding a new export there.
          const client = createNiBrainClient();
          const { error: patchError } = await client
            .from("match_fit_content_calendar_posts")
            .update({ workflow_stage: "publishing", status: "publishing", updated_at: new Date().toISOString() })
            .eq("id", id);
          if (patchError) throw new Error(patchError.message);
          const updated = await getV2Post(id);
          return NextResponse.json({ post: updated ? serializeV2Post(updated) : null });
        }

        const { job, post: updatedPost } = await fireMediaAgentForPost(id);
        return NextResponse.json({ post: serializeV2Post(updatedPost), jobId: job.id });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const post = await getV2Post(id);
    return NextResponse.json({ post: post ? serializeV2Post(post) : null });
  } catch (e) {
    console.error("[content-calendar v2 post action]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Content calendar v2 action failed.") },
      { status: isMissingContentCalendarV24SchemaError(e) ? 503 : 500 },
    );
  }
}

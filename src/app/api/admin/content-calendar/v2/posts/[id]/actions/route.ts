import { NextResponse } from "next/server";
import { z } from "zod";
import {
  approveV2Post,
  archiveV2Post,
  cancelV2ScheduledPost,
  getV2Post,
  moveV2PostToDrafts,
  regenerateV2PostMedia,
  reviveV2Post,
  runV2OptimizationJob,
  scheduleV2Post,
  serializeV2Post,
  startV2Optimization,
} from "@/lib/content-calendar/content-calendar-v2-store";
import { ensureContentCalendarV2Schema, isMissingContentCalendarV2SchemaError } from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
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
    await ensureContentCalendarV2Schema();
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
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const post = await getV2Post(id);
    return NextResponse.json({ post: post ? serializeV2Post(post) : null });
  } catch (e) {
    console.error("[content-calendar v2 post action]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Content calendar v2 action failed.") },
      { status: isMissingContentCalendarV2SchemaError(e) ? 503 : 500 },
    );
  }
}

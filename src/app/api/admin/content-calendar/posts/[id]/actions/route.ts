import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStaticMedia } from "@/lib/content-calendar/content-calendar-ai";
import {
  dismissMissedPrompt,
  markPostPosted,
  reschedulePost,
  updatePostMedia,
} from "@/lib/content-calendar/content-calendar-store";
import { isNiBrainConfigured, recordContentLearning } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("posted") }),
  z.object({ action: z.literal("dismiss_missed") }),
  z.object({
    action: z.literal("reschedule"),
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal("generate_media"),
    prompt: z.string().min(10).max(4000),
  }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!isNiBrainConfigured()) {
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
      case "dismiss_missed":
        await dismissMissedPrompt(id);
        return NextResponse.json({ ok: true });
      case "reschedule":
        await reschedulePost({ postId: id, newDate: parsed.data.newDate });
        return NextResponse.json({ ok: true });
      case "generate_media": {
        await updatePostMedia({ postId: id, mediaUrl: null, mediaStatus: "generating" });
        const result = await generateStaticMedia(parsed.data.prompt);
        if (!result) {
          await updatePostMedia({ postId: id, mediaUrl: null, mediaStatus: "failed" });
          return NextResponse.json({ error: "Image generation failed. Check OPENAI_API_KEY." }, { status: 502 });
        }
        await updatePostMedia({ postId: id, mediaUrl: result.url, mediaStatus: "ready" });
        await recordContentLearning({
          signalType: "MEDIA_GENERATED",
          postId: id,
          editedText: result.url,
          meta: { prompt: parsed.data.prompt.slice(0, 500) },
        });
        return NextResponse.json({ mediaUrl: result.url });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    console.error("[content-calendar post action]", e);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}

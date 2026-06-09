import { NextResponse } from "next/server";
import { z } from "zod";
import { updatePostCaption } from "@/lib/content-calendar/content-calendar-store";
import { isNiBrainConfiguredAsync, recordContentLearning } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

const patchSchema = z.object({
  caption: z.string().max(8000).optional(),
  visualPrompt: z.string().max(8000).nullable().optional(),
  originalCaption: z.string().optional(),
  originalVisualPrompt: z.string().nullable().optional(),
});

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
    if (parsed.data.caption !== undefined) {
      await updatePostCaption({
        postId: id,
        caption: parsed.data.caption,
        visualPrompt: parsed.data.visualPrompt,
      });
      if (
        parsed.data.originalCaption !== undefined &&
        parsed.data.originalCaption.trim() !== parsed.data.caption.trim()
      ) {
        await recordContentLearning({
          signalType: "EDIT_DIFF",
          postId: id,
          originalText: parsed.data.originalCaption,
          editedText: parsed.data.caption,
          meta: { field: "caption" },
        });
      }
      if (
        parsed.data.visualPrompt !== undefined &&
        parsed.data.originalVisualPrompt !== undefined &&
        (parsed.data.originalVisualPrompt ?? "").trim() !== (parsed.data.visualPrompt ?? "").trim()
      ) {
        await recordContentLearning({
          signalType: "EDIT_DIFF",
          postId: id,
          originalText: parsed.data.originalVisualPrompt ?? "",
          editedText: parsed.data.visualPrompt ?? "",
          meta: { field: "visualPrompt" },
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[content-calendar post PATCH]", e);
    return NextResponse.json({ error: "Could not save post." }, { status: 500 });
  }
}

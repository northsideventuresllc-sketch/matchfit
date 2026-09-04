import { NextResponse } from "next/server";
import { z } from "zod";
import { serializeV2Post, updateV2PostFields, getV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { ensureContentCalendarV2Schema, isMissingContentCalendarV2SchemaError } from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const patchSchema = z.object({
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  visualPrompt: z.string().nullable().optional(),
  theme: z.string().optional(),
  targetGroup: z.string().optional(),
  cta: z.string().optional(),
  dpmoRationale: z.string().nullable().optional(),
  postDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a YYYY-MM-DD date.")
    .nullable()
    .optional(),
  platformCaptions: z.record(z.string(), z.string()).optional(),
  platformHashtags: z.record(z.string(), z.array(z.string())).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }
  const { id } = await ctx.params;
  try {
    await ensureContentCalendarV2Schema();
    const post = await getV2Post(id);
    if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    return NextResponse.json({ post: serializeV2Post(post) });
  } catch (e) {
    console.error("[content-calendar v2 post GET]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load v2 post.") },
      { status: isMissingContentCalendarV2SchemaError(e) ? 503 : 500 },
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid post edits." }, { status: 400 });

  const { id } = await ctx.params;
  try {
    await ensureContentCalendarV2Schema();
    await updateV2PostFields({ postId: id, ...parsed.data });
    const post = await getV2Post(id);
    return NextResponse.json({ post: post ? serializeV2Post(post) : null });
  } catch (e) {
    console.error("[content-calendar v2 post PATCH]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not save v2 post edits.") },
      { status: isMissingContentCalendarV2SchemaError(e) ? 503 : 500 },
    );
  }
}

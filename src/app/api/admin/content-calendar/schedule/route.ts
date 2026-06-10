import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateBatchContent,
  generateWeekContent,
  type ContentCuratorBrief,
} from "@/lib/content-calendar/content-calendar-ai";
import {
  loadWeekSchedule,
  serializePostForClient,
  upsertWeekPosts,
} from "@/lib/content-calendar/content-calendar-store";
import { isNiBrainConfigured } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!isNiBrainConfigured()) {
    return NextResponse.json({ error: "NI Brain is not configured on the server." }, { status: 503 });
  }

  const weekStart = new URL(req.url).searchParams.get("weekStart");
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "weekStart query param required (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    const posts = await loadWeekSchedule(weekStart);
    return NextResponse.json({ posts: posts.map(serializePostForClient) });
  } catch (e) {
    console.error("[content-calendar schedule GET]", e);
    return NextResponse.json({ error: "Could not load schedule." }, { status: 500 });
  }
}

const curatorBriefSchema = z
  .object({
    goals: z.array(z.string()),
    audiences: z.array(z.string()),
    tones: z.array(z.string()),
    themes: z.array(z.string()),
    platforms: z.array(z.string()),
    postCount: z.number().int().positive().nullable(),
    notes: z.string(),
  })
  .optional();

const postSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  offset: z.number().int().min(0).max(28).default(7),
  postCount: z.number().int().min(1).max(20).optional(),
  curatorBrief: curatorBriefSchema,
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!isNiBrainConfigured()) {
    return NextResponse.json({ error: "NI Brain is not configured on the server." }, { status: 503 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const count = parsed.data.postCount ?? parsed.data.curatorBrief?.postCount ?? null;
    const brief = (parsed.data.curatorBrief ?? null) as ContentCuratorBrief | null;
    const generated =
      count != null
        ? await generateBatchContent({
            weekStart: parsed.data.weekStart,
            offset: parsed.data.offset,
            postCount: count,
            brief,
          })
        : await generateWeekContent({
            weekStart: parsed.data.weekStart,
            offset: parsed.data.offset,
          });
    const posts = await upsertWeekPosts({
      weekStart: parsed.data.weekStart,
      offset: parsed.data.offset,
      posts: generated,
      adminId: sess.adminId,
    });
    return NextResponse.json({ posts: posts.map(serializePostForClient) });
  } catch (e) {
    console.error("[content-calendar schedule POST]", e);
    return NextResponse.json({ error: "Week generation failed." }, { status: 500 });
  }
}

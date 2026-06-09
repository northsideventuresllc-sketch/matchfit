import { NextResponse } from "next/server";
import { z } from "zod";
import { generateWeekContent, regenerateCalendarPost } from "@/lib/content-calendar/content-calendar-ai";
import {
  deleteWeekPosts,
  loadWeekSchedule,
  loadWeekScheduleIncludingPosted,
  serializePostForClient,
  upsertWeekPosts,
} from "@/lib/content-calendar/content-calendar-store";
import { CONTENT_CALENDAR_POST_TYPES } from "@/lib/content-calendar/constants";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
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

const postSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  offset: z.number().int().min(0).max(28).default(7),
});

export async function DELETE(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured on the server." }, { status: 503 });
  }

  const weekStart = new URL(req.url).searchParams.get("weekStart");
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "weekStart query param required (YYYY-MM-DD)." }, { status: 400 });
  }

  try {
    await deleteWeekPosts(weekStart);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[content-calendar schedule DELETE]", e);
    return NextResponse.json({ error: "Could not delete week posts." }, { status: 500 });
  }
}

const regenerateSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  offset: z.number().int().min(0).max(28).default(7),
  feedback: z.string().max(2000).optional(),
  regenerateAll: z.literal(true),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured on the server." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const regenerateParsed = regenerateSchema.safeParse(body);
  if (regenerateParsed.success) {
    try {
      const existing = await loadWeekScheduleIncludingPosted(regenerateParsed.data.weekStart);
      const active = existing.filter((p) => !p.posted);
      if (!active.length) {
        return NextResponse.json({ error: "No posts to regenerate for this week." }, { status: 400 });
      }
      const regeneratedPosts = [];
      for (const row of active) {
        if (!CONTENT_CALENDAR_POST_TYPES.includes(row.post_type)) continue;
        const regen = await regenerateCalendarPost({
          weekStart: regenerateParsed.data.weekStart,
          offset: regenerateParsed.data.offset,
          dayIndex: row.day_index,
          postType: row.post_type,
          feedback: regenerateParsed.data.feedback,
          existingCaption: row.caption,
          existingVisualPrompt: row.visual_prompt,
        });
        if (regen) regeneratedPosts.push(regen);
      }
      if (!regeneratedPosts.length) {
        return NextResponse.json({ error: "Regeneration failed. Check AI API keys." }, { status: 502 });
      }
      const posts = await upsertWeekPosts({
        weekStart: regenerateParsed.data.weekStart,
        offset: regenerateParsed.data.offset,
        posts: regeneratedPosts,
        adminId: sess.adminId,
      });
      return NextResponse.json({ posts: posts.map(serializePostForClient) });
    } catch (e) {
      console.error("[content-calendar schedule regenerate]", e);
      return NextResponse.json({ error: "Week regeneration failed." }, { status: 500 });
    }
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    const generated = await generateWeekContent({
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

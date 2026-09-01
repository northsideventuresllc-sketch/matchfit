import { NextResponse } from "next/server";
import { z } from "zod";
import { CONTENT_CALENDAR_POST_TYPES } from "@/lib/content-calendar/constants";
import {
  createV2Draft,
  listV2Posts,
  resumeRunningV2Optimizations,
  serializeV2Post,
} from "@/lib/content-calendar/content-calendar-v2-store";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const stageSchema = z.enum(["hub", "pending", "publishing", "scheduled", "archived"]);
const laneSchema = z.enum(["scheduled", "impromptu"]);

const draftSchema = z.object({
  tempId: z.string().min(1),
  dayIndex: z.number().int().min(0).max(99),
  postType: z.enum(CONTENT_CALENDAR_POST_TYPES),
  targetGroup: z.string().min(1),
  platforms: z.string().min(1),
  caption: z.string(),
  visualPrompt: z.string().nullable().optional().default(null),
  hashtags: z.array(z.string()).default([]),
  postDate: z.string().nullable().optional().default(null),
});

const createSchema = z.object({
  draft: draftSchema,
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lane: laneSchema,
  theme: z.string().optional(),
  cta: z.string().optional(),
  postDate: z.string().nullable().optional(),
  generateMedia: z.boolean().optional().default(true),
});

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const stage = stageSchema.catch("hub").parse(url.searchParams.get("stage") ?? "hub");
  const laneRaw = url.searchParams.get("lane");
  const lane = laneRaw ? laneSchema.parse(laneRaw) : undefined;

  try {
    await ensureContentCalendarV23Schema();
    const posts = await listV2Posts({ stage, lane });
    if (stage === "publishing") void resumeRunningV2Optimizations(posts);
    return NextResponse.json({ posts: posts.map(serializeV2Post), total: posts.length });
  } catch (e) {
    console.error("[content-calendar v2 posts GET]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load content calendar v2 posts.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid v2 draft." }, { status: 400 });

  try {
    await ensureContentCalendarV23Schema();
    const row = await createV2Draft({
      draft: parsed.data.draft,
      weekStart: parsed.data.weekStart,
      lane: parsed.data.lane,
      adminId: sess.adminId,
      theme: parsed.data.theme,
      cta: parsed.data.cta,
      postDate: parsed.data.postDate,
      generateMedia: parsed.data.generateMedia,
    });
    return NextResponse.json({ post: serializeV2Post(row) });
  } catch (e) {
    console.error("[content-calendar v2 posts POST]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not save v2 draft.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import type { BulkGeneratedDraft } from "@/lib/content-calendar/content-calendar-ai";
import { loadHubPosts, loadScheduledPosts, serializePostForClient } from "@/lib/content-calendar/content-calendar-store";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { requireAdminSession } from "@/lib/require-admin";

export async function GET(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const view = new URL(req.url).searchParams.get("view") ?? "hub";

  try {
    if (view === "scheduled") {
      const posts = await loadScheduledPosts();
      return NextResponse.json({ posts: posts.map(serializePostForClient) });
    }
    const posts = await loadHubPosts();
    return NextResponse.json({ posts: posts.map(serializePostForClient), total: posts.length });
  } catch (e) {
    console.error("[content-calendar hub GET]", e);
    return NextResponse.json({ error: "Could not load content hub." }, { status: 500 });
  }
}

const saveSchema = z.object({
  draft: z.object({
    tempId: z.string(),
    dayIndex: z.number().int().min(0).max(99),
    postType: z.enum(["Carousel", "Static", "Video", "Text"]),
    targetGroup: z.string(),
    platforms: z.string(),
    caption: z.string(),
    visualPrompt: z.string().nullable(),
    hashtags: z.array(z.string()),
    postDate: z.string().nullable(),
  }),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduled: z.boolean(),
  bulkSessionId: z.string().min(1),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const { saveDraftToHub } = await import("@/lib/content-calendar/content-calendar-store");
    const row = await saveDraftToHub({
      draft: parsed.data.draft as BulkGeneratedDraft,
      weekStart: parsed.data.weekStart,
      scheduled: parsed.data.scheduled,
      adminId: sess.adminId,
      bulkSessionId: parsed.data.bulkSessionId,
    });
    return NextResponse.json({ post: serializePostForClient(row) });
  } catch (e) {
    console.error("[content-calendar hub POST]", e);
    return NextResponse.json({ error: "Could not save to content hub." }, { status: 500 });
  }
}

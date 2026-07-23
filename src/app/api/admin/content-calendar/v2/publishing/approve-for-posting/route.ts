import { NextResponse } from "next/server";
import { z } from "zod";
import { approvePublishingPostsForPosting } from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import {
  ensureContentCalendarV22Schema,
  isMissingContentCalendarV22SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  postIds: z.array(z.string().min(1)).optional(),
  platformOverrides: z.record(z.string(), z.array(z.string().min(1))).optional(),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Invalid approve-for-posting request." }, { status: 400 });

  try {
    await ensureContentCalendarV22Schema();
    const { job, postCount } = await approvePublishingPostsForPosting({
      postIds: parsed.data.postIds,
      platformOverrides: parsed.data.platformOverrides,
    });
    return NextResponse.json({ ok: true, jobId: job.id, job, postCount });
  } catch (e) {
    console.error("[content-calendar v2 approve-for-posting]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not approve posts for posting.") },
      { status: isMissingContentCalendarV22SchemaError(e) ? 503 : 500 },
    );
  }
}

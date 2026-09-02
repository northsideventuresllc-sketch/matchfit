import { NextResponse } from "next/server";
import { z } from "zod";
import { fireMediaAgentForDay } from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import {
  ensureContentCalendarV22Schema,
  isMissingContentCalendarV22SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  postDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid fire media agent request." }, { status: 400 });

  try {
    await ensureContentCalendarV22Schema();
    const { job, mediaPostCount } = await fireMediaAgentForDay(parsed.data.postDate);
    return NextResponse.json({ ok: true, jobId: job.id, job, mediaPostCount });
  } catch (e) {
    console.error("[content-calendar v2 fire media agent]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not fire the media agent job.") },
      { status: isMissingContentCalendarV22SchemaError(e) ? 503 : 500 },
    );
  }
}

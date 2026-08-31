import { NextResponse } from "next/server";
import { z } from "zod";
import { manuallyGenerateDayMedia } from "@/lib/content-calendar/content-calendar-cowork-orchestration";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  postDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Day-level manual media bypass (Lane 1): skips Cowork entirely and sends every hub post for the
 * date straight to Publishing, the same precondition as Approve Day but with no media build queued.
 */
export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid manual media generation request." }, { status: 400 });
  }

  try {
    await ensureContentCalendarV23Schema();
    const result = await manuallyGenerateDayMedia(parsed.data.postDate);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[content-calendar v2 day manually-generate-media]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not manually generate media for that day.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

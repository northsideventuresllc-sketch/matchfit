import { NextResponse } from "next/server";
import { z } from "zod";
import { sendV2PostBackToDrafts, serializeV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { ensureContentCalendarV2Schema, isMissingContentCalendarV2SchemaError } from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  postId: z.string().min(1),
});

/**
 * Pulls one post out of the batch and back into drafts. An already-posted post is refused with a
 * plain sentence (409) instead of being un-posted.
 */
export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a post to send back to drafts." }, { status: 400 });

  try {
    await ensureContentCalendarV2Schema();
    const row = await sendV2PostBackToDrafts(parsed.data.postId);
    return NextResponse.json({ ok: true, post: serializeV2Post(row) });
  } catch (e) {
    const message = formatUserFacingError(e, "Could not send that post back to drafts.");
    const alreadyPosted = message.includes("already gone out");
    if (!alreadyPosted) console.error("[content-calendar v2 pending back-to-drafts]", e);
    return NextResponse.json(
      { error: message },
      { status: alreadyPosted ? 409 : isMissingContentCalendarV2SchemaError(e) ? 503 : 500 },
    );
  }
}

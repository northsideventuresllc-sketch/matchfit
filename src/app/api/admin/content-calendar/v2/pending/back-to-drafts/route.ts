import { NextResponse } from "next/server";
import { z } from "zod";
import { sendV2PostBackToDrafts, serializeV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

const bodySchema = z.object({
  postId: z.string().min(1),
});

/**
 * @deprecated Left working (this URL may still be referenced) but the new Pending tab calls the
 * generic per-post actions route instead — `POST /api/admin/content-calendar/v2/posts/[id]/actions`
 * with `{ action: "back_to_drafts" }`, same as every other tab's "send back to drafts" — rather
 * than this standalone route. That generic action calls moveV2PostToDrafts, a slightly different
 * (simpler) transition than sendV2PostBackToDrafts below; both leave media attached.
 *
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
    await ensureContentCalendarV23Schema();
    const row = await sendV2PostBackToDrafts(parsed.data.postId);
    return NextResponse.json({ ok: true, post: serializeV2Post(row) });
  } catch (e) {
    const message = formatUserFacingError(e, "Could not send that post back to drafts.");
    const alreadyPosted = message.includes("already gone out");
    if (!alreadyPosted) console.error("[content-calendar v2 pending back-to-drafts]", e);
    return NextResponse.json(
      { error: message },
      { status: alreadyPosted ? 409 : isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { listV2Posts, serializeV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import {
  ensureContentCalendarV23Schema,
  isMissingContentCalendarV23SchemaError,
} from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

/**
 * @deprecated Thin backward-compatible alias. "Pending" is now a real workflow_stage, so this just
 * calls the generic list-by-stage function with stage: "pending" instead of the old derived
 * listPendingV2Posts() (hub+approved/publishing/scheduled union). The v2 shell's Pending tab calls
 * `GET /api/admin/content-calendar/v2/posts?stage=pending` directly instead of this route — kept
 * responding here so nothing that still points at this URL 404s.
 */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  try {
    await ensureContentCalendarV23Schema();
    const posts = await listV2Posts({ stage: "pending" });
    return NextResponse.json({ posts: posts.map(serializeV2Post), total: posts.length });
  } catch (e) {
    console.error("[content-calendar v2 pending GET]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load the posts that are waiting to go out.") },
      { status: isMissingContentCalendarV23SchemaError(e) ? 503 : 500 },
    );
  }
}

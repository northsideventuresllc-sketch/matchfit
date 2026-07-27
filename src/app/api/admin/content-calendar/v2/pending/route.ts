import { NextResponse } from "next/server";
import { listPendingV2Posts, serializeV2Post } from "@/lib/content-calendar/content-calendar-v2-store";
import { ensureContentCalendarV2Schema, isMissingContentCalendarV2SchemaError } from "@/lib/ensure-content-hub-schema";
import { isNiBrainConfiguredAsync } from "@/lib/ni-brain-client";
import { formatUserFacingError } from "@/lib/read-json-response";
import { requireAdminSession } from "@/lib/require-admin";

/** Approved posts that have not gone out yet — the Pending page's only read. */
export async function GET() {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!(await isNiBrainConfiguredAsync())) {
    return NextResponse.json({ error: "NI Brain is not configured." }, { status: 503 });
  }

  try {
    await ensureContentCalendarV2Schema();
    const posts = await listPendingV2Posts();
    return NextResponse.json({ posts: posts.map(serializeV2Post), total: posts.length });
  } catch (e) {
    console.error("[content-calendar v2 pending GET]", e);
    return NextResponse.json(
      { error: formatUserFacingError(e, "Could not load the posts that are waiting to go out.") },
      { status: isMissingContentCalendarV2SchemaError(e) ? 503 : 500 },
    );
  }
}

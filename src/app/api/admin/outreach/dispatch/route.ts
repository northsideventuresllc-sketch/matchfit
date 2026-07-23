import { NextResponse } from "next/server";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { listOutreachDispatchBatches } from "@/lib/outreach-dispatch";
import { requireAdminSession } from "@/lib/require-admin";
import { hasValidCoworkSecret } from "@/lib/require-cowork-secret";

export const dynamic = "force-dynamic";

/** Upcoming (not-yet-dispatched) batches + batches completed in the last 24h. */
export async function GET(req: Request) {
  const authed = (await hasValidCoworkSecret(req)) || Boolean(await requireAdminSession());
  if (!authed) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    await ensureOutreachHubSchema();
    const { upcoming, recentlyCompleted } = await listOutreachDispatchBatches();
    return NextResponse.json({ upcoming, recentlyCompleted });
  } catch (e) {
    console.error("[outreach dispatch GET]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not load dispatch batches." }, { status: 500 });
  }
}

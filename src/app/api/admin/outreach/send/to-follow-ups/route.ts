import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { queueManualSend } from "@/lib/outreach-dispatch";
import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().min(1),
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
});

/**
 * "Send To Follow Ups" (WF2 item 6): manually push a lead from Pending Leads into the Send Queue
 * NOW, overriding the wired follow-up clock. The lead's current lane (follow_up_1 / follow_up_2 /
 * pending) is recorded as `dispatchPreviousLane`, so the Send Queue shows the correct follow-up
 * copy and marking it sent advances the follow-up pipeline one step. Queues only — nothing sends
 * until JB marks it sent (approve-only).
 */
export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await ensureOutreachHubSchema();
    const result = await queueManualSend({ leads: [parsed.data] });
    if (result.queued.length === 0) {
      return NextResponse.json({ error: "Lead is already in the Send Queue." }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[outreach send to-follow-ups]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not queue follow-up." }, { status: 500 });
  }
}

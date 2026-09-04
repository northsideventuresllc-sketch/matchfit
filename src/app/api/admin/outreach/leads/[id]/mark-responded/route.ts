import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { OUTREACH_PLATFORM_VALUES, type OutreachPlatform } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
});

/**
 * "Responded" (WF2 item 6): move a lead from Pending Leads to Pending Responses. Flags it as
 * having an unresponded reply and switches the lane so the pending-responses tab surfaces it for a
 * drafted reply. Same lane transition the automated reply scan applies, just triggered by JB
 * marking the reply manually.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const platform = parsed.data.platform as OutreachPlatform;
  const now = new Date();

  try {
    await ensureOutreachHubSchema();

    const data = {
      outreachLane: "pending_response",
      hasUnrespondedReply: true,
      replyReceivedAt: now,
      responseReceivedAt: now,
      status: "RESPONSE_RECEIVED",
      // A responded lead is no longer queued or mid-send.
      dispatchBatchId: null,
      dispatchPreviousLane: null,
      sendMode: null,
    };

    // updateMany returns count:0 rather than throwing when the id/platform pair doesn't exist,
    // and keeps each platform's concrete delegate type (a shared union delegate isn't callable).
    let count = 0;
    if (platform === "instagram") {
      ({ count } = await prisma.outreachInstagramLead.updateMany({ where: { id }, data }));
    } else if (platform === "facebook") {
      ({ count } = await prisma.outreachFacebookLead.updateMany({ where: { id }, data }));
    } else {
      ({ count } = await prisma.outreachEmailLead.updateMany({ where: { id }, data }));
    }
    if (count === 0) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outreach lead mark-responded]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not mark lead as responded." }, { status: 500 });
  }
}

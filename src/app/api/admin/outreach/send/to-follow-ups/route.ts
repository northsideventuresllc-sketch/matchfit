import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ensureOutreachHubSchema,
  isMissingOutreachHubSchemaError,
} from "@/lib/ensure-outreach-hub-schema";
import { OUTREACH_PLATFORM_VALUES } from "@/lib/outreach-types";
import { requireAdminSession } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().min(1),
  platform: z.enum(OUTREACH_PLATFORM_VALUES),
});

/**
 * "Send To Follow Ups" (WF2 item 6): manually mark a lead's follow-up as due NOW, overriding the 
 * wired follow-up clock. This makes the lead immediately appear in the "Today's Leads" tab under 
 * "Follow Ups", where JB can edit/approve it before it flows to the Send Queue.
 */
export async function POST(req: Request) {
  const sess = await requireAdminSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await ensureOutreachHubSchema();
    const { id, platform } = parsed.data;
    const now = new Date();
    
    if (platform === "instagram") {
      const lead = await prisma.outreachInstagramLead.findUnique({ where: { id } });
      if (lead) {
        if (lead.outreachLane === "follow_up_1") {
          await prisma.outreachInstagramLead.update({ where: { id }, data: { followUp1DueAt: now } });
        } else if (lead.outreachLane === "follow_up_2") {
          await prisma.outreachInstagramLead.update({ where: { id }, data: { followUp2DueAt: now } });
        }
      }
    } else if (platform === "email") {
      const lead = await prisma.outreachEmailLead.findUnique({ where: { id } });
      if (lead) {
        if (lead.outreachLane === "follow_up_1") {
          await prisma.outreachEmailLead.update({ where: { id }, data: { followUp1DueAt: now } });
        } else if (lead.outreachLane === "follow_up_2") {
          await prisma.outreachEmailLead.update({ where: { id }, data: { followUp2DueAt: now } });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[outreach send to-follow-ups]", e);
    if (isMissingOutreachHubSchemaError(e)) {
      return NextResponse.json({ error: "Outreach schema is still updating." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not override follow-up clock." }, { status: 500 });
  }
}

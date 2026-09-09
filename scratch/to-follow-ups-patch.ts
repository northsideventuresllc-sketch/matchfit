import { prisma } from "@/lib/prisma";
import type { OutreachPlatform } from "@/lib/outreach-types";

export async function overrideFollowUpClock(platform: OutreachPlatform, leadId: string) {
  const now = new Date();
  if (platform === "instagram") {
    const lead = await prisma.outreachInstagramLead.findUnique({ where: { id: leadId } });
    if (!lead) return;
    if (lead.outreachLane === "follow_up_1") {
      await prisma.outreachInstagramLead.update({ where: { id: leadId }, data: { followUp1DueAt: now } });
    } else if (lead.outreachLane === "follow_up_2") {
      await prisma.outreachInstagramLead.update({ where: { id: leadId }, data: { followUp2DueAt: now } });
    }
  } else if (platform === "email") {
    const lead = await prisma.outreachEmailLead.findUnique({ where: { id: leadId } });
    if (!lead) return;
    if (lead.outreachLane === "follow_up_1") {
      await prisma.outreachEmailLead.update({ where: { id: leadId }, data: { followUp1DueAt: now } });
    } else if (lead.outreachLane === "follow_up_2") {
      await prisma.outreachEmailLead.update({ where: { id: leadId }, data: { followUp2DueAt: now } });
    }
  }
}

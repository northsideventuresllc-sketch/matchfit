import { addBusinessDaysUtc } from "@/lib/business-days";
import { prisma } from "@/lib/prisma";

/** Call when a DIY engagement is funded (Terms §6). */
export async function createDiyPlanEngagement(args: {
  trainerId: string;
  clientId: string;
  engagementStartedAt?: Date;
}): Promise<{ id: string; firstDeliverByAt: Date }> {
  const start = args.engagementStartedAt ?? new Date();
  const firstDeliverByAt = addBusinessDaysUtc(start, 5);
  const row = await prisma.diyPlanEngagement.create({
    data: {
      trainerId: args.trainerId,
      clientId: args.clientId,
      engagementStartedAt: start,
      firstDeliverByAt,
      status: "PENDING_DELIVERY",
    },
    select: { id: true, firstDeliverByAt: true },
  });
  return { id: row.id, firstDeliverByAt: row.firstDeliverByAt };
}

/** Trainer dashboard: mark first DIY artifact delivered (stops refund clock). */
export async function markDiyFirstDeliveryComplete(id: string): Promise<void> {
  await prisma.diyPlanEngagement.update({
    where: { id },
    data: {
      firstDeliveredAt: new Date(),
      status: "DELIVERED",
    },
  });
}

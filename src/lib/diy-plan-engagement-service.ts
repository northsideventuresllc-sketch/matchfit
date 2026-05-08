import { addBusinessDaysUtc } from "@/lib/business-days";
import { prisma } from "@/lib/prisma";

/** Call when a DIY engagement is funded (Terms §6 / governed marketplace). */
export async function createDiyPlanEngagement(args: {
  trainerId: string;
  clientId: string;
  engagementStartedAt?: Date;
  sourceServiceTransactionId?: string | null;
}): Promise<{ id: string; firstDeliverByAt: Date; wallClockDeliverableDueAt: Date }> {
  const start = args.engagementStartedAt ?? new Date();
  const firstDeliverByAt = addBusinessDaysUtc(start, 5);
  const wall = new Date(start);
  wall.setDate(wall.getDate() + 14);

  const row = await prisma.diyPlanEngagement.create({
    data: {
      trainerId: args.trainerId,
      clientId: args.clientId,
      engagementStartedAt: start,
      firstDeliverByAt,
      wallClockDeliverableDueAt: wall,
      status: "PENDING_DELIVERY",
      sourceServiceTransactionId: args.sourceServiceTransactionId?.trim() || undefined,
    },
    select: { id: true, firstDeliverByAt: true, wallClockDeliverableDueAt: true },
  });
  return {
    id: row.id,
    firstDeliverByAt: row.firstDeliverByAt,
    wallClockDeliverableDueAt: row.wallClockDeliverableDueAt ?? wall,
  };
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

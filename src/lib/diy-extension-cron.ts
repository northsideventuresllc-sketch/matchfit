import { prisma } from "@/lib/prisma";

/** Client has 48h to approve a DIY extension; otherwise auto-approved (Terms). */
export async function processDiyExtensionAutoApprovals(now = new Date()): Promise<number> {
  const rows = await prisma.diyPlanEngagement.findMany({
    where: {
      extensionStatus: "PENDING",
      extensionClientDecisionByAt: { not: null, lte: now },
    },
    select: {
      id: true,
      firstDeliverByAt: true,
      extensionHoursRequested: true,
    },
  });
  let n = 0;
  for (const r of rows) {
    const hours = Math.max(0, r.extensionHoursRequested ?? 0);
    const newDeadline = new Date(r.firstDeliverByAt.getTime() + hours * 60 * 60 * 1000);
    await prisma.diyPlanEngagement.update({
      where: { id: r.id },
      data: {
        extensionStatus: "AUTO_APPROVED",
        extendedDeliverableDueAt: newDeadline,
        firstDeliverByAt: newDeadline,
        trainerUrgentUploadDeadlineAt: null,
        updatedAt: now,
      },
    });
    n += 1;
  }
  return n;
}

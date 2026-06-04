import type { CheckrReportPaidPayload } from "@/lib/checkr";
import { prisma } from "@/lib/prisma";

export async function recordCheckrBackgroundCheckPaid(payload: CheckrReportPaidPayload): Promise<void> {
  const cents = Math.max(1, Math.floor(payload.vendorPaidCents));
  await prisma.trainerProfile.update({
    where: { trainerId: payload.trainerId },
    data: {
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents: cents,
      ...(payload.reportId ? { checkrReportId: payload.reportId } : {}),
      ...(payload.candidateId ? { checkrCandidateId: payload.candidateId } : {}),
      updatedAt: new Date(),
    },
  });
}

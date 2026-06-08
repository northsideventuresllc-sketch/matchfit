import { prisma } from "@/lib/prisma";
import { isTrainerOnboardingFeePaymentOverdue } from "@/lib/trainer-onboarding-fee-deadline";

export async function processTrainerOnboardingFeeDeadlineExpirations(): Promise<number> {
  const rows = await prisma.trainerProfile.findMany({
    where: {
      hasSignedTOS: true,
      onboardingFeePaymentDeadlineAt: { not: null },
      onboardingFeePaymentExpiredAt: null,
      registrationFeeHoldStatus: { in: ["NOT_STARTED", "CANCELED"] },
      hasPaidRegistrationFee: false,
    },
    select: {
      trainerId: true,
      onboardingFeePaymentDeadlineAt: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
    },
  });

  let expired = 0;
  const now = new Date();
  for (const row of rows) {
    if (!isTrainerOnboardingFeePaymentOverdue(row, now)) continue;
    await prisma.$transaction([
      prisma.trainerProfile.update({
        where: { trainerId: row.trainerId },
        data: { onboardingFeePaymentExpiredAt: now, updatedAt: now },
      }),
      prisma.trainer.update({
        where: { id: row.trainerId },
        data: { deidentifiedAt: now, updatedAt: now },
      }),
    ]);
    expired += 1;
  }
  return expired;
}

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { trainerOnboardingFeeDeadlineAt } from "@/lib/trainer-onboarding-fee-deadline";
import { trainerRegistrationPricingModeForNewTrainer } from "@/lib/trainer-registration-fee";

/**
 * Marks a trainer as pending onboarding after Terms acceptance.
 * Starts the 7-day onboarding fee + compliance window once (does not reset an existing clock).
 */
export async function markTrainerPendingAfterTermsAcceptance(
  trainerId: string,
  now = new Date(),
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  const paymentDeadline = trainerOnboardingFeeDeadlineAt(now);

  const existing = await db.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      complianceWindowStartedAt: true,
      limitedDashboardUnlockedAt: true,
      onboardingFeePaymentDeadlineAt: true,
    },
  });

  const windowAlreadyStarted = Boolean(existing?.complianceWindowStartedAt);
  const pendingProfileData = {
    hasSignedTOS: true,
    ...(windowAlreadyStarted
      ? {}
      : {
          limitedDashboardUnlockedAt: existing?.limitedDashboardUnlockedAt ?? now,
          complianceWindowStartedAt: now,
          onboardingFeePaymentDeadlineAt: existing?.onboardingFeePaymentDeadlineAt ?? paymentDeadline,
        }),
    updatedAt: now,
  };

  await db.trainer.update({
    where: { id: trainerId },
    data: {
      termsAcceptedAt: now,
      privacyPolicyAcceptedAt: now,
    },
  });

  if (existing) {
    await db.trainerProfile.update({
      where: { trainerId },
      data: pendingProfileData,
    });
    return;
  }

  await db.trainerProfile.create({
    data: {
      trainerId,
      registrationFeeHoldStatus: "NOT_STARTED",
      registrationFeePricingMode: trainerRegistrationPricingModeForNewTrainer(0),
      complianceCertFailedAttempts: 0,
      ...pendingProfileData,
    },
  });
}

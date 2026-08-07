import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { TRAINER_FITHUB_PROMO_MS } from "@/lib/trainer-compliance-window";
import { trainerOnboardingFeeDeadlineAt } from "@/lib/trainer-onboarding-fee-deadline";
import { addTrainerPlatformTrialDays } from "@/lib/trainer-platform-trial-constants";
import { trainerRegistrationPricingModeForNewTrainer } from "@/lib/trainer-registration-fee";

/**
 * Marks a trainer as pending onboarding after Terms acceptance.
 * Starts the 7-day onboarding fee + compliance window once (does not reset an existing clock).
 * Also starts the Independent Pro 60-day free platform trial at registration.
 *
 * Signup order is credentials -> terms -> tier -> dashboard (`trainer-signup-next-path.ts`), so
 * the account tier is NOT known yet when this runs — `platformTrialEndsAt` is stamped for every
 * trainer here regardless of what tier they will eventually pick. Elite Fitness Pro must never
 * carry a free trial (it is the one tier that always pays immediately, JB spec 2026-08-07), so
 * once the tier is actually locked in at `/api/trainer/signup/select-tier`, that route clears
 * `platformTrialEndsAt` back to null for `elite_fitness_pro`. If another place ever locks in the
 * tier (e.g. a future admin override), it needs the same clear — see `persistTierSelection` in
 * `src/app/api/trainer/signup/select-tier/route.ts` for the reference implementation.
 */
export async function markTrainerPendingAfterTermsAcceptance(
  trainerId: string,
  now = new Date(),
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  const paymentDeadline = trainerOnboardingFeeDeadlineAt(now);
  const platformTrialEndsAt = addTrainerPlatformTrialDays(now);
  const fitHubPromoEndsAt = new Date(now.getTime() + TRAINER_FITHUB_PROMO_MS);

  const existing = await db.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      complianceWindowStartedAt: true,
      limitedDashboardUnlockedAt: true,
      onboardingFeePaymentDeadlineAt: true,
      fitHubPromoEndsAt: true,
    },
  });

  const existingTrainer = await db.trainer.findUnique({
    where: { id: trainerId },
    select: { platformTrialEndsAt: true },
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
          fitHubPromoEndsAt: existing?.fitHubPromoEndsAt ?? fitHubPromoEndsAt,
        }),
    updatedAt: now,
  };

  await db.trainer.update({
    where: { id: trainerId },
    data: {
      termsAcceptedAt: now,
      privacyPolicyAcceptedAt: now,
      ...(existingTrainer?.platformTrialEndsAt
        ? {}
        : {
            platformTrialEndsAt,
            platformTrialConsumed: false,
          }),
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

/**
 * Repairs trainers who accepted Terms or started onboarding but are missing profile flags
 * required for admin pending-trainer counts and pipeline views.
 */
export async function repairStaleTrainerPendingRecords(limit = 120): Promise<number> {
  const candidates = await prisma.trainer.findMany({
    where: {
      NOT: {
        profile: { is: { dashboardActivatedAt: { not: null } } },
      },
      OR: [
        { termsAcceptedAt: { not: null } },
        { profile: { is: { hasSignedTOS: true } } },
        { profile: { is: { complianceWindowStartedAt: { not: null } } } },
        { profile: { is: { limitedDashboardUnlockedAt: { not: null } } } },
        { profile: { is: { registrationFeeHoldStatus: { in: ["HELD", "CAPTURED"] } } } },
      ],
    },
    select: {
      id: true,
      termsAcceptedAt: true,
      createdAt: true,
      profile: {
        select: {
          hasSignedTOS: true,
          complianceWindowStartedAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  let repaired = 0;
  for (const candidate of candidates) {
    const profile = candidate.profile;
    const needsRepair =
      Boolean(candidate.termsAcceptedAt && !profile) ||
      Boolean(candidate.termsAcceptedAt && !profile?.hasSignedTOS) ||
      Boolean(candidate.termsAcceptedAt && !profile?.complianceWindowStartedAt) ||
      Boolean(profile?.hasSignedTOS && !profile?.complianceWindowStartedAt);

    if (!needsRepair) continue;

    const anchor =
      candidate.termsAcceptedAt ??
      profile?.complianceWindowStartedAt ??
      candidate.createdAt;

    await markTrainerPendingAfterTermsAcceptance(candidate.id, anchor);
    repaired += 1;
  }

  return repaired;
}

import { assertTrainerBetaSlotInTransaction, countLaunchTrainersInTx } from "@/lib/beta-cap-enforcement";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { trainerRegistrationPricingModeForNewTrainer } from "@/lib/trainer-registration-fee";
import { normalizeTrainerServiceZip } from "@/lib/trainer-service-zip";
import { trainerSignupSchema } from "@/lib/validations/trainer-register";
import type { z } from "zod";

export type TrainerSignupParsed = z.infer<typeof trainerSignupSchema>;

/**
 * Persists a new trainer row + default profile (same shape as POST /api/trainer/register).
 */
export async function createTrainerRecord(
  body: TrainerSignupParsed,
  options?: { betaInviteEntryId?: string | null },
): Promise<{ id: string; email: string }> {
  const username = body.username.trim();
  const email = body.email.trim().toLowerCase();
  const passwordHash = await hashPassword(body.password);
  const serviceZipCode = normalizeTrainerServiceZip(body.serviceZipCode);

  return prisma.$transaction(
    async (tx) => {
      await assertTrainerBetaSlotInTransaction(tx, options?.betaInviteEntryId ?? null);
      const trainerCountBefore = await countLaunchTrainersInTx(tx);
      const registrationFeePricingMode = trainerRegistrationPricingModeForNewTrainer(trainerCountBefore);
      /** Legacy UI flag: true for founding tier (20% of Checkr BG), not a full $100 waiver. */
      const registrationFeeWaived = registrationFeePricingMode === "FOUNDING_BG_SURCHARGE_20PCT";

      const trainer = await tx.trainer.create({
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          username,
          phone: body.phone.trim(),
          email,
          passwordHash,
          termsAcceptedAt: new Date(),
          privacyPolicyAcceptedAt: new Date(),
          profile: {
            create: {
              registrationFeeWaived,
              registrationFeePricingMode,
              ...(serviceZipCode ? { serviceZipCode } : {}),
              backgroundCheckStatus: "NOT_STARTED",
              certificationReviewStatus: "NOT_STARTED",
              nutritionistCertificationReviewStatus: "NOT_STARTED",
              specialistCertificationReviewStatus: "NOT_STARTED",
              backgroundCheckReviewStatus: "NOT_STARTED",
              onboardingTrackCpt: false,
              onboardingTrackNutrition: false,
              onboardingTrackSpecialist: false,
              otherCertificationReviewStatus: "NOT_STARTED",
            },
          },
        },
        select: { id: true },
      });

      return { id: trainer.id, email };
    },
    { isolationLevel: "Serializable" },
  );
}

import { isNextTrainerEligibleForRegistrationWaiver } from "@/lib/match-fit-launch-promotions";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { trainerSignupSchema } from "@/lib/validations/trainer-register";
import type { z } from "zod";

export type TrainerSignupParsed = z.infer<typeof trainerSignupSchema>;

/**
 * Persists a new trainer row + default profile (same shape as POST /api/trainer/register).
 */
export async function createTrainerRecord(body: TrainerSignupParsed): Promise<{ id: string; email: string }> {
  const username = body.username.trim();
  const email = body.email.trim().toLowerCase();
  const passwordHash = await hashPassword(body.password);

  const trainerCountBefore = await prisma.trainer.count();
  const registrationFeeWaived = isNextTrainerEligibleForRegistrationWaiver(trainerCountBefore);

  const trainer = await prisma.trainer.create({
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
}

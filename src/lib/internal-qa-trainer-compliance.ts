import { prisma } from "@/lib/prisma";
import {
  isMatchFitInternalQaEnabled,
  isMatchFitInternalQaTrainerEmail,
} from "@/lib/match-fit-internal-qa";
import {
  TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
  TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
  TRAINER_DEV_FAKE_SPECIALIST_CERTIFICATION_PATH,
} from "@/lib/trainer-dev-cert-placeholders";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";

function internalQaW9Json(legalName: string): string {
  return JSON.stringify({
    legalName,
    businessName: "",
    federalTaxClassification: "Individual/sole proprietor",
    addressLine1: "123 Internal QA Way",
    addressLine2: "",
    city: "New York",
    state: "NY",
    zip: "10001",
    tinType: "SSN",
    tin: "000000000",
    submittedAt: new Date().toISOString(),
  });
}

/** Idempotent: full compliance + premium for listed internal QA trainer emails only. */
export async function ensureInternalQaTrainerFullCompliance(trainerId: string): Promise<boolean> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      preferredName: true,
    },
  });
  if (!trainer || !isMatchFitInternalQaEnabled() || !isMatchFitInternalQaTrainerEmail(trainer.email)) {
    return false;
  }

  const now = new Date();
  const legalName =
    trainer.preferredName?.trim() ||
    [trainer.firstName, trainer.lastName].filter(Boolean).join(" ").trim() ||
    "Internal QA Trainer";

  await prisma.trainerProfile.upsert({
    where: { trainerId },
    create: {
      trainerId,
      hasSignedTOS: true,
      hasUploadedW9: true,
      hasPaidBackgroundFee: true,
      w9Json: internalQaW9Json(legalName),
      backgroundCheckStatus: "APPROVED",
      backgroundCheckReviewStatus: "APPROVED",
      backgroundCheckClearedAt: now,
      backgroundCheckExpiryWarningSentAt: null,
      backgroundCheckPaidCents: 10000,
      signupFeeBalancePaidAt: now,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: true,
      specialistProfessionalRole: "cscs",
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: "APPROVED",
      specialistCertificationReviewStatus: "APPROVED",
      otherCertificationReviewStatus: "APPROVED",
      certificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
      nutritionistCertificationUrl: TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
      specialistCertificationUrl: TRAINER_DEV_FAKE_SPECIALIST_CERTIFICATION_PATH,
      otherCertificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
      dashboardActivatedAt: now,
      matchQuestionnaireStatus: "completed",
      matchQuestionnaireCompletedAt: now,
      aiMatchProfileText: "Internal QA trainer — full compliance and premium access for product testing.",
      premiumStudioEnabledAt: now,
      clientsCanPurchaseServicesFromProfile: true,
    },
    update: {
      hasSignedTOS: true,
      hasUploadedW9: true,
      hasPaidBackgroundFee: true,
      w9Json: internalQaW9Json(legalName),
      backgroundCheckStatus: "APPROVED",
      backgroundCheckReviewStatus: "APPROVED",
      backgroundCheckClearedAt: now,
      backgroundCheckExpiryWarningSentAt: null,
      backgroundCheckPaidCents: 10000,
      signupFeeBalancePaidAt: now,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: true,
      specialistProfessionalRole: "cscs",
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: "APPROVED",
      specialistCertificationReviewStatus: "APPROVED",
      otherCertificationReviewStatus: "APPROVED",
      certificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
      nutritionistCertificationUrl: TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
      specialistCertificationUrl: TRAINER_DEV_FAKE_SPECIALIST_CERTIFICATION_PATH,
      otherCertificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
      dashboardActivatedAt: now,
      matchQuestionnaireStatus: "completed",
      matchQuestionnaireCompletedAt: now,
      aiMatchProfileText: "Internal QA trainer — full compliance and premium access for product testing.",
      premiumStudioEnabledAt: now,
      clientsCanPurchaseServicesFromProfile: true,
    },
  });

  await maybeActivateTrainerDashboard(trainerId);
  return true;
}

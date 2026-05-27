import { prisma } from "@/lib/prisma";
import {
  TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
  TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
} from "@/lib/trainer-dev-cert-placeholders";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";

function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Comma-separated trainer emails that receive full test compliance (any environment). */
export function getMatchFitTestTrainerEmails(): string[] {
  return parseEmailList(process.env.MATCH_FIT_TEST_TRAINER_EMAILS);
}

export function isMatchFitTestTrainerEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return getMatchFitTestTrainerEmails().includes(email.trim().toLowerCase());
}

export function matchFitTestTrainerProfileComplianceData(now = new Date()) {
  return {
    hasSignedTOS: true,
    hasUploadedW9: true,
    hasPaidBackgroundFee: true,
    hasPaidRegistrationFee: true,
    backgroundCheckStatus: "APPROVED",
    backgroundCheckReviewStatus: "APPROVED",
    backgroundCheckClearedAt: now,
    onboardingTrackCpt: true,
    onboardingTrackNutrition: true,
    onboardingTrackSpecialist: false,
    specialistProfessionalRole: null,
    specialistCertificationUrl: null,
    specialistCertificationReviewStatus: "NOT_STARTED" as const,
    certificationReviewStatus: "APPROVED" as const,
    nutritionistCertificationReviewStatus: "APPROVED" as const,
    certificationUrl: TRAINER_DEV_FAKE_CPT_CERTIFICATION_PATH,
    nutritionistCertificationUrl: TRAINER_DEV_FAKE_NUTRITION_CERTIFICATION_PATH,
    dashboardActivatedAt: now,
    premiumStudioEnabledAt: now,
    matchQuestionnaireStatus: "completed",
    matchQuestionnaireCompletedAt: now,
    matchQuestionnaireAnswers: JSON.stringify({
      offersInPerson: true,
      inPersonZip: "30301",
    }),
    aiMatchProfileText:
      "Match Fit owner test trainer — CPT and nutrition paths approved for full service template QA.",
  };
}

/** Applies background check + CPT/nutrition approvals for allowlisted test trainer emails only. */
export async function applyMatchFitTestTrainerCompliance(trainerId: string): Promise<boolean> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { email: true },
  });
  if (!trainer || !isMatchFitTestTrainerEmail(trainer.email)) return false;

  const data = matchFitTestTrainerProfileComplianceData();
  await prisma.trainerProfile.upsert({
    where: { trainerId },
    create: { trainerId, ...data },
    update: data,
  });
  await maybeActivateTrainerDashboard(trainerId);
  return true;
}

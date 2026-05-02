import { prisma } from "@/lib/prisma";

/**
 * Older trainer rows may have APPROVED credentials but onboarding track flags still false
 * (tracks were added after first go-live). This unlocks dashboard service publishing and browse scoring.
 */
export async function backfillTrainerOnboardingTracksFromLegacyState(trainerId: string): Promise<void> {
  const p = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
      specialistCertificationReviewStatus: true,
      certificationUrl: true,
      nutritionistCertificationUrl: true,
      specialistCertificationUrl: true,
      dashboardActivatedAt: true,
      matchQuestionnaireStatus: true,
    },
  });
  if (!p) return;

  const data: {
    onboardingTrackCpt?: boolean;
    onboardingTrackNutrition?: boolean;
    onboardingTrackSpecialist?: boolean;
  } = {};

  if (!p.onboardingTrackCpt && p.certificationReviewStatus === "APPROVED") {
    data.onboardingTrackCpt = true;
  }
  if (!p.onboardingTrackNutrition && p.nutritionistCertificationReviewStatus === "APPROVED") {
    data.onboardingTrackNutrition = true;
  }
  if (!p.onboardingTrackSpecialist && (p.specialistCertificationReviewStatus ?? "NOT_STARTED") === "APPROVED") {
    data.onboardingTrackSpecialist = true;
  }

  // Activated dashboard before track flags existed: infer from any credential signal or completed questionnaire.
  const noTrainingTrack = !p.onboardingTrackCpt && !p.onboardingTrackSpecialist;
  if (
    p.dashboardActivatedAt &&
    noTrainingTrack &&
    !data.onboardingTrackCpt &&
    !data.onboardingTrackSpecialist
  ) {
    const cptSignal =
      p.certificationReviewStatus !== "NOT_STARTED" ||
      Boolean(p.certificationUrl?.trim());
    const specSignal =
      (p.specialistCertificationReviewStatus ?? "NOT_STARTED") !== "NOT_STARTED" ||
      Boolean(p.specialistCertificationUrl?.trim());
    if (specSignal) data.onboardingTrackSpecialist = true;
    else if (cptSignal) data.onboardingTrackCpt = true;
    else if (p.matchQuestionnaireStatus === "completed") data.onboardingTrackCpt = true;
  }

  if (!p.onboardingTrackNutrition && !data.onboardingTrackNutrition) {
    const nutSignal =
      p.nutritionistCertificationReviewStatus !== "NOT_STARTED" ||
      Boolean(p.nutritionistCertificationUrl?.trim());
    if (p.dashboardActivatedAt && nutSignal) data.onboardingTrackNutrition = true;
  }

  if (Object.keys(data).length === 0) return;

  await prisma.trainerProfile.update({
    where: { trainerId },
    data,
  });
}

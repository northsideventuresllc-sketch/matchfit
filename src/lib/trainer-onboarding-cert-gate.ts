export type TrainerCertificationGateProfile = {
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  onboardingTrackSpecialist?: boolean;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
  specialistCertificationReviewStatus?: string;
};

/** Each selected track must reach APPROVED before W-9 / dashboard activation. */
export function certificationsGatePassed(prof: TrainerCertificationGateProfile): boolean {
  const cptOk = !prof.onboardingTrackCpt || prof.certificationReviewStatus === "APPROVED";
  const nutOk = !prof.onboardingTrackNutrition || prof.nutritionistCertificationReviewStatus === "APPROVED";
  const specOn = prof.onboardingTrackSpecialist === true;
  const specOk = !specOn || (prof.specialistCertificationReviewStatus ?? "NOT_STARTED") === "APPROVED";
  return cptOk && nutOk && specOk;
}

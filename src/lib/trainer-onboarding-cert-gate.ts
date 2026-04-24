export type TrainerCertificationGateProfile = {
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
};

/** Each selected track must reach APPROVED before W-9 / dashboard activation. */
export function certificationsGatePassed(prof: TrainerCertificationGateProfile): boolean {
  const cptOk = !prof.onboardingTrackCpt || prof.certificationReviewStatus === "APPROVED";
  const nutOk = !prof.onboardingTrackNutrition || prof.nutritionistCertificationReviewStatus === "APPROVED";
  return cptOk && nutOk;
}

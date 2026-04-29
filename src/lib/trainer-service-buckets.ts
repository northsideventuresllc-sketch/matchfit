/**
 * Trainers choose CPT and/or nutrition paths during onboarding (`onboardingTrack*`).
 * They may only **offer** catalog services for a path once that credential is APPROVED.
 */
export type TrainerServiceBucketProfile = {
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
};

export function trainerSelectedCptTrack(p: TrainerServiceBucketProfile): boolean {
  return p.onboardingTrackCpt;
}

export function trainerSelectedNutritionTrack(p: TrainerServiceBucketProfile): boolean {
  return p.onboardingTrackNutrition;
}

export function trainerCptCredentialApproved(p: TrainerServiceBucketProfile): boolean {
  return p.certificationReviewStatus === "APPROVED";
}

export function trainerNutritionCredentialApproved(p: TrainerServiceBucketProfile): boolean {
  return p.nutritionistCertificationReviewStatus === "APPROVED";
}

/** Personal-training / CPT catalog offerings (track + approved credential). */
export function trainerOffersPersonalTrainingServices(p: TrainerServiceBucketProfile): boolean {
  return trainerSelectedCptTrack(p) && trainerCptCredentialApproved(p);
}

/** Nutrition catalog offerings (track + approved credential). */
export function trainerOffersNutritionServices(p: TrainerServiceBucketProfile): boolean {
  return trainerSelectedNutritionTrack(p) && trainerNutritionCredentialApproved(p);
}

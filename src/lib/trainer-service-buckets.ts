/**
 * Trainers choose CPT and/or nutrition paths during onboarding (`onboardingTrack*`).
 * They may only **offer** catalog services for a path once that credential is APPROVED.
 */
export type TrainerServiceBucketProfile = {
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  onboardingTrackSpecialist?: boolean;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
  specialistCertificationReviewStatus?: string;
};

export function trainerSelectedCptTrack(p: TrainerServiceBucketProfile): boolean {
  return p.onboardingTrackCpt;
}

export function trainerSelectedSpecialistTrack(p: TrainerServiceBucketProfile): boolean {
  return p.onboardingTrackSpecialist === true;
}

/** CPT or accredited specialist path selected for training-style catalog services. */
export function trainerHasPersonalTrainingPathSelected(p: TrainerServiceBucketProfile): boolean {
  return p.onboardingTrackCpt || p.onboardingTrackSpecialist === true;
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

export function trainerSpecialistCredentialApproved(p: TrainerServiceBucketProfile): boolean {
  return (p.specialistCertificationReviewStatus ?? "NOT_STARTED") === "APPROVED";
}

/** Personal-training catalog: approved CPT **or** approved specialist credential (paths are mutually exclusive in onboarding). */
export function trainerOffersPersonalTrainingServices(p: TrainerServiceBucketProfile): boolean {
  const cptPath = trainerSelectedCptTrack(p) && trainerCptCredentialApproved(p);
  const specialistPath = trainerSelectedSpecialistTrack(p) && trainerSpecialistCredentialApproved(p);
  return cptPath || specialistPath;
}

/** Nutrition catalog offerings (track + approved credential). */
export function trainerOffersNutritionServices(p: TrainerServiceBucketProfile): boolean {
  return trainerSelectedNutritionTrack(p) && trainerNutritionCredentialApproved(p);
}

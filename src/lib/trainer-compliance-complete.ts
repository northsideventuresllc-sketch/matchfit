import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";

export type TrainerComplianceProfileFields = {
  hasSignedTOS: boolean;
  hasUploadedW9: boolean;
  backgroundCheckStatus: string;
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
};

/** True when onboarding compliance checklist is fully satisfied (same gates as dashboard activation). */
export function isTrainerComplianceComplete(prof: TrainerComplianceProfileFields | null | undefined): boolean {
  if (!prof) return false;
  if (!prof.hasSignedTOS || !prof.hasUploadedW9) return false;
  if (prof.backgroundCheckStatus !== "APPROVED") return false;
  return certificationsGatePassed(prof);
}

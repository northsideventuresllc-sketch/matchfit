import { isBackgroundCheckExpired } from "@/lib/trainer-background-check-renewal";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";

export type TrainerComplianceProfileFields = {
  hasSignedTOS: boolean;
  hasUploadedW9: boolean;
  backgroundCheckStatus: string;
  /** When screening last cleared APPROVED (12-month renewal clock). */
  backgroundCheckClearedAt?: Date | string | null;
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  onboardingTrackSpecialist?: boolean;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
  specialistCertificationReviewStatus?: string;
};

/** True when onboarding compliance checklist is fully satisfied (same gates as dashboard activation). */
export function isTrainerComplianceComplete(prof: TrainerComplianceProfileFields | null | undefined): boolean {
  if (!prof) return false;
  if (!prof.hasSignedTOS || !prof.hasUploadedW9) return false;
  if (prof.backgroundCheckStatus !== "APPROVED") return false;
  const clearedRaw = prof.backgroundCheckClearedAt;
  const cleared =
    clearedRaw == null
      ? null
      : typeof clearedRaw === "string"
        ? new Date(clearedRaw)
        : clearedRaw;
  if (isBackgroundCheckExpired(cleared)) return false;
  return certificationsGatePassed(prof);
}

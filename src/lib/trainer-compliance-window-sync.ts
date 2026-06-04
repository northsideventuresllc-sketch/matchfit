import { prisma } from "@/lib/prisma";
import {
  TRAINER_COMPLIANCE_HUMAN_REVIEW_MS,
  TRAINER_COMPLIANCE_MAX_CERT_FAILURES,
  TRAINER_COMPLIANCE_WINDOW_MS,
  TRAINER_FITHUB_PROMO_MS,
  trainerBackgroundNeedsHumanReview,
  trainerComplianceWindowShouldPause,
  trainerComplianceWindowComplete,
} from "@/lib/trainer-compliance-window";
import { captureTrainerSignupFeeHold, cancelTrainerSignupFeeHold } from "@/lib/trainer-signup-fee-hold";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";

type ProfileRow = {
  trainerId: string;
  complianceWindowStartedAt: Date | null;
  complianceWindowPausedAt: Date | null;
  complianceCertReuploadDeadlineAt: Date | null;
  complianceHumanReviewDeadlineAt: Date | null;
  complianceCertFailedAttempts: number;
  complianceWindowExpiredAt: Date | null;
  registrationFeeHoldPaymentIntentId: string | null;
  registrationFeeHoldStatus: string;
  hasPaidRegistrationFee: boolean;
  fitHubPromoEndsAt: Date | null;
  onboardingTrackCpt: boolean;
  onboardingTrackNutrition: boolean;
  onboardingTrackSpecialist: boolean;
  certificationReviewStatus: string;
  nutritionistCertificationReviewStatus: string;
  specialistCertificationReviewStatus: string;
  backgroundCheckStatus: string;
  checkrReportId: string | null;
};

const profileSelect = {
  trainerId: true,
  complianceWindowStartedAt: true,
  complianceWindowPausedAt: true,
  complianceCertReuploadDeadlineAt: true,
  complianceHumanReviewDeadlineAt: true,
  complianceCertFailedAttempts: true,
  complianceWindowExpiredAt: true,
  registrationFeeHoldPaymentIntentId: true,
  registrationFeeHoldStatus: true,
  hasPaidRegistrationFee: true,
  fitHubPromoEndsAt: true,
  onboardingTrackCpt: true,
  onboardingTrackNutrition: true,
  onboardingTrackSpecialist: true,
  certificationReviewStatus: true,
  nutritionistCertificationReviewStatus: true,
  specialistCertificationReviewStatus: true,
  backgroundCheckStatus: true,
  checkrReportId: true,
} as const;

function trackDenied(status: string | null | undefined): boolean {
  return (status ?? "").trim().toUpperCase() === "DENIED";
}

function anyCertDenied(prof: ProfileRow): boolean {
  if (prof.onboardingTrackCpt && trackDenied(prof.certificationReviewStatus)) return true;
  if (prof.onboardingTrackNutrition && trackDenied(prof.nutritionistCertificationReviewStatus)) return true;
  if (prof.onboardingTrackSpecialist && trackDenied(prof.specialistCertificationReviewStatus)) return true;
  return false;
}

export async function applyTrainerSignupFeeHoldAuthorized(args: {
  trainerId: string;
  paymentIntentId: string;
  paidCents: number;
}): Promise<void> {
  const now = new Date();
  await prisma.trainerProfile.update({
    where: { trainerId: args.trainerId },
    data: {
      registrationFeeHoldPaymentIntentId: args.paymentIntentId,
      registrationFeeHoldStatus: "HELD",
      limitedDashboardUnlockedAt: now,
      complianceWindowStartedAt: now,
      hasPaidRegistrationFee: false,
      registrationFeePaidCents: args.paidCents > 0 ? args.paidCents : undefined,
      updatedAt: now,
    },
  });
}

export async function syncTrainerComplianceWindow(trainerId: string): Promise<void> {
  const prof = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: profileSelect,
  });
  if (!prof?.complianceWindowStartedAt || prof.complianceWindowExpiredAt) return;

  const now = new Date();
  const data: Record<string, unknown> = { updatedAt: now };

  if (trainerComplianceWindowShouldPause(prof) && !prof.complianceWindowPausedAt) {
    data.complianceWindowPausedAt = now;
  }

  if (trainerBackgroundNeedsHumanReview(prof) && !prof.complianceHumanReviewDeadlineAt) {
    data.complianceHumanReviewDeadlineAt = new Date(now.getTime() + TRAINER_COMPLIANCE_HUMAN_REVIEW_MS);
  }

  if (anyCertDenied(prof)) {
    const attempts = prof.complianceCertFailedAttempts + 1;
    data.complianceCertFailedAttempts = attempts;
    data.complianceWindowPausedAt = null;
    data.complianceCertReuploadDeadlineAt = new Date(now.getTime() + TRAINER_COMPLIANCE_WINDOW_MS);
    if (attempts >= TRAINER_COMPLIANCE_MAX_CERT_FAILURES) {
      data.complianceWindowExpiredAt = now;
    }
  }

  if (Object.keys(data).length > 1) {
    await prisma.trainerProfile.update({ where: { trainerId }, data: data as never });
  }

  const refreshed = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: profileSelect,
  });
  if (!refreshed) return;

  if (trainerComplianceWindowComplete(refreshed) && refreshed.registrationFeeHoldStatus === "HELD") {
    const piId = refreshed.registrationFeeHoldPaymentIntentId?.trim();
    if (piId) {
      await captureTrainerSignupFeeHold(piId);
      await prisma.trainerProfile.update({
        where: { trainerId },
        data: {
          registrationFeeHoldStatus: "CAPTURED",
          hasPaidRegistrationFee: true,
          fitHubPromoEndsAt: new Date(now.getTime() + TRAINER_FITHUB_PROMO_MS),
          updatedAt: now,
        },
      });
    }
    await maybeActivateTrainerDashboard(trainerId);
    return;
  }

  await maybeActivateTrainerDashboard(trainerId);
}

export async function expireTrainerComplianceWindow(trainerId: string): Promise<void> {
  const prof = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      registrationFeeHoldPaymentIntentId: true,
      registrationFeeHoldStatus: true,
      complianceWindowExpiredAt: true,
    },
  });
  if (!prof || prof.complianceWindowExpiredAt) return;

  const now = new Date();
  const piId = prof.registrationFeeHoldPaymentIntentId?.trim();
  if (piId && prof.registrationFeeHoldStatus === "HELD") {
    await cancelTrainerSignupFeeHold(piId);
  }

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      complianceWindowExpiredAt: now,
      registrationFeeHoldStatus: prof.registrationFeeHoldStatus === "HELD" ? "CANCELED" : prof.registrationFeeHoldStatus,
      updatedAt: now,
    },
  });

  await prisma.trainer.update({
    where: { id: trainerId },
    data: { deidentifiedAt: now },
  });
}

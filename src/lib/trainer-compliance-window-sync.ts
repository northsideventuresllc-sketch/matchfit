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
import type { CheckrBackgroundReviewStatus } from "@/lib/checkr";
import {
  cancelTrainerSignupFeeHold,
  captureTrainerSignupFeeHoldOnComplianceSuccess,
  captureTrainerSignupFeeHoldPartial,
} from "@/lib/trainer-signup-fee-hold";
import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow";
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
  registrationFeePricingMode: string;
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
  registrationFeePricingMode: true,
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

export async function applyTrainerBackgroundCheckReviewOutcome(args: {
  trainerId: string;
  backgroundCheckStatus: CheckrBackgroundReviewStatus;
  reportId?: string;
  candidateId?: string;
}): Promise<void> {
  const now = new Date();
  const data: Record<string, unknown> = {
    backgroundCheckStatus: args.backgroundCheckStatus,
    updatedAt: now,
  };
  if (args.reportId?.trim()) data.checkrReportId = args.reportId.trim();
  if (args.candidateId?.trim()) data.checkrCandidateId = args.candidateId.trim();

  if (args.backgroundCheckStatus === "APPROVED") {
    data.backgroundCheckReviewStatus = "APPROVED";
    data.backgroundCheckClearedAt = now;
  } else if (args.backgroundCheckStatus === "NEEDS_FURTHER_REVIEW") {
    data.backgroundCheckReviewStatus = "NEEDS_FURTHER_REVIEW";
    data.backgroundCheckClearedAt = null;
  } else if (args.backgroundCheckStatus === "DENIED") {
    data.backgroundCheckReviewStatus = "DENIED";
    data.backgroundCheckClearedAt = null;
  } else {
    data.backgroundCheckReviewStatus = "PENDING";
  }

  await prisma.trainerProfile.update({
    where: { trainerId: args.trainerId },
    data: data as never,
  });

  if (args.backgroundCheckStatus === "DENIED") {
    await expireTrainerComplianceWindow(args.trainerId);
    return;
  }

  await maybeActivateTrainerDashboard(args.trainerId);
}

export async function applyTrainerSignupFeeHoldAuthorized(args: {
  trainerId: string;
  paymentIntentId: string;
  paidCents: number;
  pricingMode?: TrainerRegistrationPricingMode;
}): Promise<void> {
  const now = new Date();
  const mode = args.pricingMode ?? "FOUNDING_BG_SURCHARGE_20PCT";
  const split = computeTrainerSignupEscrowSplit(mode);
  await prisma.trainerProfile.update({
    where: { trainerId: args.trainerId },
    data: {
      registrationFeeHoldPaymentIntentId: args.paymentIntentId,
      registrationFeeHoldStatus: "HELD",
      limitedDashboardUnlockedAt: now,
      complianceWindowStartedAt: now,
      hasPaidRegistrationFee: false,
      registrationFeePaidCents: args.paidCents > 0 ? args.paidCents : undefined,
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents: split.backgroundCheckEscrowCents,
      backgroundCheckEscrowCents: split.backgroundCheckEscrowCents,
      platformEscrowCents: split.platformEscrowCents,
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
      const pricingMode = (refreshed.registrationFeePricingMode ??
        "FOUNDING_BG_SURCHARGE_20PCT") as TrainerRegistrationPricingMode;
      await captureTrainerSignupFeeHoldOnComplianceSuccess(piId, pricingMode);
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
  const holdHeld = prof.registrationFeeHoldStatus === "HELD";
  const bgStatus = (
    await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { backgroundCheckStatus: true, registrationFeePricingMode: true },
    })
  )?.backgroundCheckStatus;
  const bgApproved = (bgStatus ?? "").trim().toUpperCase() === "APPROVED";

  if (piId && holdHeld) {
    if (bgApproved) {
      await cancelTrainerSignupFeeHold(piId);
    } else {
      const pricingMode = (
        await prisma.trainerProfile.findUnique({
          where: { trainerId },
          select: { registrationFeePricingMode: true },
        })
      )?.registrationFeePricingMode as TrainerRegistrationPricingMode | undefined;
      await captureTrainerSignupFeeHoldPartial(
        piId,
        pricingMode ?? "FOUNDING_BG_SURCHARGE_20PCT",
        "bg_failure",
      );
    }
  }

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      complianceWindowExpiredAt: now,
      registrationFeeHoldStatus: holdHeld ? (bgApproved ? "CANCELED" : "CAPTURED") : prof.registrationFeeHoldStatus,
      ...(!bgApproved && holdHeld
        ? {
            hasPaidBackgroundFee: false,
            backgroundCheckVendorPaidCents: null,
          }
        : {}),
      updatedAt: now,
    },
  });

  await prisma.trainer.update({
    where: { id: trainerId },
    data: { deidentifiedAt: now },
  });
}

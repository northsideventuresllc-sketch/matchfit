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
  captureTrainerSignupBackgroundEscrowHold,
  captureTrainerSignupFeeHoldOnComplianceSuccess,
  captureTrainerSignupFeeHoldPartial,
  captureTrainerSignupPlatformHold,
  releaseTrainerSignupPlatformHold,
} from "@/lib/trainer-signup-fee-hold";
import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { activateTrainerDeferredFeeOnCompliance } from "@/lib/trainer-deferred-fee";

type ProfileRow = {
  trainerId: string;
  complianceWindowStartedAt: Date | null;
  complianceWindowPausedAt: Date | null;
  complianceCertReuploadDeadlineAt: Date | null;
  complianceHumanReviewDeadlineAt: Date | null;
  complianceCertFailedAttempts: number;
  complianceWindowExpiredAt: Date | null;
  registrationFeeHoldPaymentIntentId: string | null;
  backgroundCheckEscrowPaymentIntentId: string | null;
  registrationFeeHoldStatus: string;
  backgroundCheckEscrowHoldStatus: string;
  registrationFeePricingMode: string;
  hasPaidRegistrationFee: boolean;
  hasPaidBackgroundFee: boolean;
  backgroundCheckVendorPaidCents: number | null;
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
  backgroundCheckEscrowPaymentIntentId: true,
  registrationFeeHoldStatus: true,
  backgroundCheckEscrowHoldStatus: true,
  registrationFeePricingMode: true,
  hasPaidRegistrationFee: true,
  hasPaidBackgroundFee: true,
  backgroundCheckVendorPaidCents: true,
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

function resolveTrainerSignupPricingMode(
  prof: Pick<ProfileRow, "registrationFeePricingMode">,
): TrainerRegistrationPricingMode {
  return prof.registrationFeePricingMode === "STANDARD_100_MINUS_BG"
    ? "STANDARD_100_MINUS_BG"
    : "FOUNDING_BG_SURCHARGE_20PCT";
}

function trainerUsesSplitSignupHolds(
  prof: Pick<ProfileRow, "backgroundCheckEscrowPaymentIntentId">,
): boolean {
  return Boolean(prof.backgroundCheckEscrowPaymentIntentId?.trim());
}

function backgroundCheckScreeningComplete(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toUpperCase();
  return normalized === "APPROVED" || normalized === "DENIED" || normalized === "NEEDS_FURTHER_REVIEW";
}

/** Capture the Checkr escrow slice once screening has run (approved, denied, or in human review). */
export async function captureTrainerBackgroundCheckEscrowIfReady(trainerId: string): Promise<void> {
  const prof = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      backgroundCheckEscrowPaymentIntentId: true,
      backgroundCheckEscrowHoldStatus: true,
      registrationFeePricingMode: true,
      backgroundCheckStatus: true,
      backgroundCheckEscrowCents: true,
    },
  });
  if (!prof?.backgroundCheckEscrowPaymentIntentId?.trim()) return;
  if ((prof.backgroundCheckEscrowHoldStatus ?? "").trim().toUpperCase() !== "HELD") return;
  if (!backgroundCheckScreeningComplete(prof.backgroundCheckStatus)) return;

  const pricingMode = resolveTrainerSignupPricingMode(prof);
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  await captureTrainerSignupBackgroundEscrowHold(
    prof.backgroundCheckEscrowPaymentIntentId.trim(),
    pricingMode,
  );
  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      backgroundCheckEscrowHoldStatus: "CAPTURED",
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents: prof.backgroundCheckEscrowCents ?? split.backgroundCheckEscrowCents,
      updatedAt: new Date(),
    },
  });
}

/** Release the platform onboarding hold when compliance review fails. */
export async function releaseTrainerSignupPlatformHoldIfHeld(trainerId: string): Promise<void> {
  const prof = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      registrationFeeHoldPaymentIntentId: true,
      registrationFeeHoldStatus: true,
    },
  });
  if (!prof?.registrationFeeHoldPaymentIntentId?.trim()) return;
  if ((prof.registrationFeeHoldStatus ?? "").trim().toUpperCase() !== "HELD") return;

  await releaseTrainerSignupPlatformHold(prof.registrationFeeHoldPaymentIntentId.trim());
  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      registrationFeeHoldStatus: "CANCELED",
      updatedAt: new Date(),
    },
  });
}

async function captureTrainerSignupPlatformOnComplianceSuccess(trainerId: string, prof: ProfileRow): Promise<void> {
  const platformPiId = prof.registrationFeeHoldPaymentIntentId?.trim();
  if (!platformPiId || prof.registrationFeeHoldStatus !== "HELD") return;

  const pricingMode = resolveTrainerSignupPricingMode(prof);
  if (trainerUsesSplitSignupHolds(prof)) {
    await captureTrainerSignupPlatformHold(platformPiId, pricingMode);
  } else {
    await captureTrainerSignupFeeHoldOnComplianceSuccess(platformPiId, pricingMode);
  }

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      registrationFeeHoldStatus: "CAPTURED",
      hasPaidRegistrationFee: true,
      fitHubPromoEndsAt: new Date(Date.now() + TRAINER_FITHUB_PROMO_MS),
      updatedAt: new Date(),
    },
  });
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

  if (backgroundCheckScreeningComplete(args.backgroundCheckStatus)) {
    await captureTrainerBackgroundCheckEscrowIfReady(args.trainerId);
  }

  if (args.backgroundCheckStatus === "DENIED") {
    await releaseTrainerSignupPlatformHoldIfHeld(args.trainerId);
    await expireTrainerComplianceWindow(args.trainerId);
    return;
  }

  if (args.backgroundCheckStatus === "APPROVED") {
    await syncTrainerComplianceWindow(args.trainerId);
  }

  await maybeActivateTrainerDashboard(args.trainerId);
}

export async function applyTrainerSignupPlatformHoldAuthorized(args: {
  trainerId: string;
  paymentIntentId: string;
  pendingBackgroundCheckEscrowPaymentIntentId?: string | null;
  paidCents: number;
  pricingMode?: TrainerRegistrationPricingMode;
}): Promise<void> {
  const now = new Date();
  const mode = args.pricingMode ?? "FOUNDING_BG_SURCHARGE_20PCT";
  const split = computeTrainerSignupEscrowSplit(mode);
  const pendingBgPi = args.pendingBackgroundCheckEscrowPaymentIntentId?.trim() || null;

  await prisma.trainerProfile.update({
    where: { trainerId: args.trainerId },
    data: {
      registrationFeeHoldPaymentIntentId: args.paymentIntentId,
      backgroundCheckEscrowPaymentIntentId: pendingBgPi,
      registrationFeeHoldStatus: "HELD",
      backgroundCheckEscrowHoldStatus: pendingBgPi ? "NOT_STARTED" : "NOT_STARTED",
      limitedDashboardUnlockedAt: now,
      complianceWindowStartedAt: now,
      hasPaidRegistrationFee: false,
      registrationFeePaidCents: args.paidCents > 0 ? args.paidCents : undefined,
      hasPaidBackgroundFee: false,
      backgroundCheckVendorPaidCents: null,
      backgroundCheckEscrowCents: split.backgroundCheckEscrowCents,
      platformEscrowCents: split.platformEscrowCents,
      updatedAt: now,
    },
  });
}

export async function applyTrainerSignupBackgroundEscrowHoldAuthorized(args: {
  trainerId: string;
  paymentIntentId: string;
}): Promise<void> {
  const now = new Date();
  await prisma.trainerProfile.update({
    where: { trainerId: args.trainerId },
    data: {
      backgroundCheckEscrowPaymentIntentId: args.paymentIntentId,
      backgroundCheckEscrowHoldStatus: "HELD",
      hasPaidBackgroundFee: false,
      updatedAt: now,
    },
  });
}

export async function applyTrainerSignupFeeHoldAuthorized(args: {
  trainerId: string;
  paymentIntentId: string;
  backgroundCheckEscrowPaymentIntentId?: string | null;
  paidCents: number;
  pricingMode?: TrainerRegistrationPricingMode;
}): Promise<void> {
  const now = new Date();
  const mode = args.pricingMode ?? "FOUNDING_BG_SURCHARGE_20PCT";
  const split = computeTrainerSignupEscrowSplit(mode);
  const bgPiId = args.backgroundCheckEscrowPaymentIntentId?.trim() || null;
  const splitHolds = Boolean(bgPiId);

  await prisma.trainerProfile.update({
    where: { trainerId: args.trainerId },
    data: {
      registrationFeeHoldPaymentIntentId: args.paymentIntentId,
      backgroundCheckEscrowPaymentIntentId: bgPiId,
      registrationFeeHoldStatus: "HELD",
      backgroundCheckEscrowHoldStatus: splitHolds ? "HELD" : "NOT_STARTED",
      limitedDashboardUnlockedAt: now,
      complianceWindowStartedAt: now,
      hasPaidRegistrationFee: false,
      registrationFeePaidCents: args.paidCents > 0 ? args.paidCents : undefined,
      hasPaidBackgroundFee: false,
      backgroundCheckVendorPaidCents: null,
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

  if (trainerComplianceWindowComplete(refreshed)) {
    await captureTrainerBackgroundCheckEscrowIfReady(trainerId);
    const deferredTrainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        registrationFeeDeferred: true,
        registrationFeeDeferredBalanceCents: true,
      },
    });
    const pricingMode = resolveTrainerSignupPricingMode(refreshed);
    if (
      deferredTrainer?.registrationFeeDeferred &&
      deferredTrainer.registrationFeeDeferredBalanceCents === 0 &&
      refreshed.registrationFeeHoldStatus !== "HELD"
    ) {
      await activateTrainerDeferredFeeOnCompliance(trainerId, pricingMode);
    } else if (refreshed.registrationFeeHoldStatus === "HELD") {
      const latest = await prisma.trainerProfile.findUnique({
        where: { trainerId },
        select: profileSelect,
      });
      if (latest) {
        await captureTrainerSignupPlatformOnComplianceSuccess(trainerId, latest);
      }
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
      backgroundCheckEscrowPaymentIntentId: true,
      registrationFeeHoldStatus: true,
      backgroundCheckEscrowHoldStatus: true,
      complianceWindowExpiredAt: true,
      backgroundCheckStatus: true,
      registrationFeePricingMode: true,
    },
  });
  if (!prof || prof.complianceWindowExpiredAt) return;

  const now = new Date();
  const splitHolds = trainerUsesSplitSignupHolds(prof);

  if (splitHolds) {
    if (backgroundCheckScreeningComplete(prof.backgroundCheckStatus)) {
      await captureTrainerBackgroundCheckEscrowIfReady(trainerId);
    }
    await releaseTrainerSignupPlatformHoldIfHeld(trainerId);
  } else {
    const piId = prof.registrationFeeHoldPaymentIntentId?.trim();
    const holdHeld = prof.registrationFeeHoldStatus === "HELD";
    const bgApproved = (prof.backgroundCheckStatus ?? "").trim().toUpperCase() === "APPROVED";

    if (piId && holdHeld) {
      const pricingMode = resolveTrainerSignupPricingMode(prof);
      if (bgApproved) {
        await releaseTrainerSignupPlatformHold(piId);
      } else if (backgroundCheckScreeningComplete(prof.backgroundCheckStatus)) {
        await captureTrainerSignupFeeHoldPartial(piId, pricingMode, "bg_failure");
      } else {
        await releaseTrainerSignupPlatformHold(piId);
      }
    }
  }

  const refreshed = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      registrationFeeHoldStatus: true,
      backgroundCheckEscrowHoldStatus: true,
      hasPaidBackgroundFee: true,
    },
  });

  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      complianceWindowExpiredAt: now,
      ...(refreshed?.registrationFeeHoldStatus === "HELD"
        ? { registrationFeeHoldStatus: "CANCELED" }
        : {}),
      updatedAt: now,
    },
  });

  await prisma.trainer.update({
    where: { id: trainerId },
    data: { deidentifiedAt: now },
  });
}

import { certificationsGatePassed, type TrainerCertificationGateProfile } from "@/lib/trainer-onboarding-cert-gate";
import { coerceTrainerBackgroundVendorStatus } from "@/lib/trainer-onboarding-status";

export const TRAINER_COMPLIANCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const TRAINER_COMPLIANCE_HUMAN_REVIEW_MS = 28 * 24 * 60 * 60 * 1000;
export const TRAINER_COMPLIANCE_MAX_CERT_FAILURES = 3;
export const TRAINER_FITHUB_PROMO_MS = 28 * 24 * 60 * 60 * 1000;

export type TrainerComplianceWindowProfile = TrainerCertificationGateProfile & {
  complianceWindowStartedAt?: Date | string | null;
  complianceWindowPausedAt?: Date | string | null;
  complianceCertReuploadDeadlineAt?: Date | string | null;
  complianceHumanReviewDeadlineAt?: Date | string | null;
  complianceCertFailedAttempts?: number | null;
  complianceWindowExpiredAt?: Date | string | null;
  backgroundCheckStatus?: string | null;
  checkrReportId?: string | null;
  certificationReviewStatus?: string | null;
  nutritionistCertificationReviewStatus?: string | null;
  specialistCertificationReviewStatus?: string | null;
};

function toDate(raw: Date | string | null | undefined): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function certTrackStatuses(prof: TrainerComplianceWindowProfile): string[] {
  const out: string[] = [];
  if (prof.onboardingTrackCpt) out.push((prof.certificationReviewStatus ?? "NOT_STARTED").trim().toUpperCase());
  if (prof.onboardingTrackNutrition) {
    out.push((prof.nutritionistCertificationReviewStatus ?? "NOT_STARTED").trim().toUpperCase());
  }
  if (prof.onboardingTrackSpecialist) {
    out.push((prof.specialistCertificationReviewStatus ?? "NOT_STARTED").trim().toUpperCase());
  }
  return out;
}

/** True when every selected track has left NOT_STARTED (uploaded / in review). */
export function trainerCertificationSubmitted(prof: TrainerComplianceWindowProfile): boolean {
  const tracks = certTrackStatuses(prof);
  if (tracks.length === 0) return false;
  return tracks.every((s) => s !== "NOT_STARTED");
}

export function trainerBackgroundCheckSubmitted(prof: TrainerComplianceWindowProfile): boolean {
  const status = coerceTrainerBackgroundVendorStatus(prof.backgroundCheckStatus);
  if (status !== "NOT_STARTED") return true;
  return Boolean(prof.checkrReportId?.trim());
}

export function trainerComplianceWindowShouldPause(prof: TrainerComplianceWindowProfile): boolean {
  return trainerCertificationSubmitted(prof) && trainerBackgroundCheckSubmitted(prof);
}

export function trainerBackgroundNeedsHumanReview(prof: TrainerComplianceWindowProfile): boolean {
  const status = coerceTrainerBackgroundVendorStatus(prof.backgroundCheckStatus);
  return status === "NEEDS_FURTHER_REVIEW";
}

export type TrainerComplianceWindowState = {
  started: boolean;
  paused: boolean;
  expired: boolean;
  humanReviewActive: boolean;
  deadlineAt: Date | null;
  daysRemaining: number | null;
  certFailedAttempts: number;
  certReuploadDeadlineAt: Date | null;
  humanReviewDeadlineAt: Date | null;
};

export function evaluateTrainerComplianceWindow(
  prof: TrainerComplianceWindowProfile | null | undefined,
  now = new Date(),
): TrainerComplianceWindowState {
  const empty: TrainerComplianceWindowState = {
    started: false,
    paused: false,
    expired: false,
    humanReviewActive: false,
    deadlineAt: null,
    daysRemaining: null,
    certFailedAttempts: 0,
    certReuploadDeadlineAt: null,
    humanReviewDeadlineAt: null,
  };
  if (!prof) return empty;

  const startedAt = toDate(prof.complianceWindowStartedAt);
  if (!startedAt) return empty;

  const expiredAt = toDate(prof.complianceWindowExpiredAt);
  if (expiredAt) {
    return {
      ...empty,
      started: true,
      expired: true,
      certFailedAttempts: Math.max(0, prof.complianceCertFailedAttempts ?? 0),
    };
  }

  const certFailures = Math.max(0, prof.complianceCertFailedAttempts ?? 0);
  if (certFailures >= TRAINER_COMPLIANCE_MAX_CERT_FAILURES) {
    return {
      ...empty,
      started: true,
      expired: true,
      certFailedAttempts: certFailures,
    };
  }

  const certReuploadDeadlineAt = toDate(prof.complianceCertReuploadDeadlineAt);
  if (certReuploadDeadlineAt && now > certReuploadDeadlineAt) {
    return {
      ...empty,
      started: true,
      expired: true,
      certFailedAttempts: certFailures,
      certReuploadDeadlineAt,
    };
  }

  const humanReviewDeadlineAt = toDate(prof.complianceHumanReviewDeadlineAt);
  if (humanReviewDeadlineAt && now > humanReviewDeadlineAt) {
    return {
      ...empty,
      started: true,
      expired: true,
      humanReviewActive: true,
      humanReviewDeadlineAt,
      certFailedAttempts: certFailures,
    };
  }

  const humanReviewActive = trainerBackgroundNeedsHumanReview(prof);
  const paused = Boolean(prof.complianceWindowPausedAt) || trainerComplianceWindowShouldPause(prof);

  let deadlineAt: Date;
  if (certReuploadDeadlineAt) {
    deadlineAt = certReuploadDeadlineAt;
  } else if (humanReviewActive && humanReviewDeadlineAt) {
    deadlineAt = humanReviewDeadlineAt;
  } else if (paused) {
    deadlineAt = new Date(startedAt.getTime() + TRAINER_COMPLIANCE_WINDOW_MS);
  } else {
    deadlineAt = new Date(startedAt.getTime() + TRAINER_COMPLIANCE_WINDOW_MS);
  }

  if (!paused && !humanReviewActive && now > deadlineAt) {
    return {
      started: true,
      paused: false,
      expired: true,
      humanReviewActive: false,
      deadlineAt,
      daysRemaining: 0,
      certFailedAttempts: certFailures,
      certReuploadDeadlineAt,
      humanReviewDeadlineAt,
    };
  }

  const msLeft = Math.max(0, deadlineAt.getTime() - now.getTime());
  const daysRemaining = paused && !certReuploadDeadlineAt && !humanReviewActive
    ? null
    : Math.ceil(msLeft / (24 * 60 * 60 * 1000));

  return {
    started: true,
    paused,
    expired: false,
    humanReviewActive,
    deadlineAt,
    daysRemaining,
    certFailedAttempts: certFailures,
    certReuploadDeadlineAt,
    humanReviewDeadlineAt,
  };
}

export function trainerComplianceWindowComplete(prof: TrainerComplianceWindowProfile): boolean {
  const bg = coerceTrainerBackgroundVendorStatus(prof.backgroundCheckStatus);
  return bg === "APPROVED" && certificationsGatePassed(prof);
}

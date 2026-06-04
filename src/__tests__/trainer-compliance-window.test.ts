import { describe, expect, it } from "vitest";
import {
  evaluateTrainerComplianceWindow,
  trainerBackgroundCheckSubmitted,
  trainerCertificationSubmitted,
  trainerComplianceWindowShouldPause,
  TRAINER_COMPLIANCE_MAX_CERT_FAILURES,
} from "@/lib/trainer-compliance-window";

const baseProfile = {
  onboardingTrackCpt: true,
  onboardingTrackNutrition: false,
  onboardingTrackSpecialist: false,
  certificationReviewStatus: "NOT_STARTED",
  nutritionistCertificationReviewStatus: "NOT_STARTED",
  specialistCertificationReviewStatus: "NOT_STARTED",
  backgroundCheckStatus: "NOT_STARTED",
  checkrReportId: null,
  complianceCertFailedAttempts: 0,
};

describe("trainerComplianceWindow", () => {
  it("pauses when cert and background check are both submitted", () => {
    const prof = {
      ...baseProfile,
      certificationReviewStatus: "PENDING",
      backgroundCheckStatus: "PENDING",
    };
    expect(trainerCertificationSubmitted(prof)).toBe(true);
    expect(trainerBackgroundCheckSubmitted(prof)).toBe(true);
    expect(trainerComplianceWindowShouldPause(prof)).toBe(true);
  });

  it("expires after seven days when not paused", () => {
    const started = new Date("2026-01-01T12:00:00.000Z");
    const state = evaluateTrainerComplianceWindow(
      {
        ...baseProfile,
        complianceWindowStartedAt: started,
      },
      new Date("2026-01-09T12:00:01.000Z"),
    );
    expect(state.expired).toBe(true);
  });

  it("does not expire at six days", () => {
    const started = new Date("2026-01-01T12:00:00.000Z");
    const state = evaluateTrainerComplianceWindow(
      {
        ...baseProfile,
        complianceWindowStartedAt: started,
      },
      new Date("2026-01-07T11:00:00.000Z"),
    );
    expect(state.expired).toBe(false);
    expect(state.daysRemaining).toBeGreaterThanOrEqual(1);
    expect(state.daysRemaining).toBeLessThanOrEqual(2);
  });

  it("expires after max cert failures", () => {
    const state = evaluateTrainerComplianceWindow({
      ...baseProfile,
      complianceWindowStartedAt: new Date(),
      complianceCertFailedAttempts: TRAINER_COMPLIANCE_MAX_CERT_FAILURES,
    });
    expect(state.expired).toBe(true);
  });
});

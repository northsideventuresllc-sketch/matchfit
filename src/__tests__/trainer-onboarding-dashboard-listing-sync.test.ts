import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, syncFpListingStatusForComplianceMock, syncTrainerComplianceWindowMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  syncFpListingStatusForComplianceMock: vi.fn().mockResolvedValue(null),
  syncTrainerComplianceWindowMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerProfile: { findUnique: findUniqueMock, update: vi.fn() },
  },
}));

vi.mock("@/lib/fp-listing-status-sync", () => ({
  syncFpListingStatusForCompliance: syncFpListingStatusForComplianceMock,
}));

vi.mock("@/lib/trainer-compliance-window-sync", () => ({
  syncTrainerComplianceWindow: syncTrainerComplianceWindowMock,
}));

import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";

describe("maybeActivateTrainerDashboard — listing status sync wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncFpListingStatusForComplianceMock.mockResolvedValue(null);
    syncTrainerComplianceWindowMock.mockResolvedValue(undefined);
  });

  it("syncs listing status even when the dashboard was already activated earlier (the coachj case: a LATE-clearing background check webhook fires after activation)", async () => {
    findUniqueMock.mockResolvedValue({
      dashboardActivatedAt: new Date("2026-01-01"), // already activated before this call
      hasSignedTOS: true,
      hasUploadedW9: true,
      backgroundCheckStatus: "APPROVED",
      backgroundCheckClearedAt: new Date("2026-08-01"),
      onboardingTrackCpt: true,
      onboardingTrackNutrition: false,
      onboardingTrackSpecialist: false,
      certificationReviewStatus: "APPROVED",
      nutritionistCertificationReviewStatus: null,
      specialistCertificationReviewStatus: null,
      limitedDashboardUnlockedAt: new Date("2025-12-01"),
      registrationFeeHoldStatus: "CAPTURED",
      hasPaidRegistrationFee: true,
      complianceWindowExpiredAt: null,
      complianceWindowStartedAt: new Date("2025-12-01"),
      complianceWindowPausedAt: null,
      complianceCertReuploadDeadlineAt: null,
      complianceHumanReviewDeadlineAt: null,
      complianceCertFailedAttempts: 0,
      checkrReportId: "rep_1",
      fitHubPromoEndsAt: null,
    });

    await maybeActivateTrainerDashboard("trainer_coachj");

    expect(syncFpListingStatusForComplianceMock).toHaveBeenCalledWith("trainer_coachj");
    // Called before the dashboardActivatedAt short-circuit — proven by findUnique never even
    // being required for the sync call to have happened.
    expect(syncFpListingStatusForComplianceMock).toHaveBeenCalledTimes(1);
  });

  it("still syncs listing status when the trainer profile has no rows to activate", async () => {
    findUniqueMock.mockResolvedValue(null);
    await maybeActivateTrainerDashboard("trainer_missing");
    expect(syncFpListingStatusForComplianceMock).toHaveBeenCalledWith("trainer_missing");
  });
});

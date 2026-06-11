import { describe, expect, it } from "vitest";
import {
  TRAINER_VERIFICATION_IN_PROGRESS_CLIENT_MESSAGE,
  isTrainerBookableForClients,
  isTrainerPreVerifiedForClientDiscovery,
  isTrainerVisibleInClientDiscovery,
  trainerBookableBlockedMessage,
  trainerVerificationBadgeForClient,
} from "@/lib/trainer-client-discovery";

const fullyVerifiedProfile = {
  hasSignedTOS: true,
  hasUploadedW9: true,
  backgroundCheckStatus: "APPROVED",
  backgroundCheckClearedAt: new Date("2026-01-01T00:00:00.000Z"),
  onboardingTrackCpt: true,
  onboardingTrackNutrition: false,
  onboardingTrackSpecialist: false,
  certificationReviewStatus: "APPROVED",
  nutritionistCertificationReviewStatus: "NOT_APPLICABLE",
  specialistCertificationReviewStatus: "NOT_APPLICABLE",
  limitedDashboardUnlockedAt: new Date("2026-01-01T00:00:00.000Z"),
  dashboardActivatedAt: new Date("2026-02-01T00:00:00.000Z"),
};

const preVerifiedProfile = {
  ...fullyVerifiedProfile,
  hasUploadedW9: false,
  backgroundCheckStatus: "PENDING",
  certificationReviewStatus: "PENDING",
  dashboardActivatedAt: null,
};

describe("trainer-client-discovery", () => {
  it("treats TOS + limited dashboard unlock as pre-verified discovery visibility", () => {
    expect(isTrainerPreVerifiedForClientDiscovery(preVerifiedProfile)).toBe(true);
    expect(isTrainerVisibleInClientDiscovery(preVerifiedProfile)).toBe(true);
    expect(trainerVerificationBadgeForClient(preVerifiedProfile)).toBe("verification_in_progress");
  });

  it("treats activated compliant coaches as verified and bookable", () => {
    expect(isTrainerBookableForClients(fullyVerifiedProfile)).toBe(true);
    expect(isTrainerVisibleInClientDiscovery(fullyVerifiedProfile)).toBe(true);
    expect(trainerVerificationBadgeForClient(fullyVerifiedProfile)).toBe("verified");
    expect(trainerBookableBlockedMessage(fullyVerifiedProfile)).toBeNull();
  });

  it("blocks purchases for pre-verified coaches with the client-facing message", () => {
    expect(isTrainerBookableForClients(preVerifiedProfile)).toBe(false);
    expect(trainerBookableBlockedMessage(preVerifiedProfile)).toBe(
      TRAINER_VERIFICATION_IN_PROGRESS_CLIENT_MESSAGE,
    );
  });

  it("hides coaches without TOS or limited dashboard access", () => {
    expect(
      isTrainerVisibleInClientDiscovery({
        ...preVerifiedProfile,
        hasSignedTOS: false,
      }),
    ).toBe(false);
    expect(
      isTrainerVisibleInClientDiscovery({
        ...preVerifiedProfile,
        limitedDashboardUnlockedAt: null,
      }),
    ).toBe(false);
  });
});

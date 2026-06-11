import { describe, expect, it } from "vitest";
import {
  buildAdminTrainerSearchClause,
  buildTrainerPendingQualifications,
  resolveTrainerMembershipStatus,
  trainerMembershipStatusLabel,
} from "@/lib/trainer-membership-status";

describe("trainer membership status", () => {
  it("marks trainers with ToS but no live dashboard as pending", () => {
    expect(
      resolveTrainerMembershipStatus({
        trainer: { termsAcceptedAt: new Date("2026-06-01T00:00:00.000Z") },
        profile: { hasSignedTOS: true, dashboardActivatedAt: null },
      }),
    ).toBe("pending");
    expect(trainerMembershipStatusLabel("pending")).toBe("Pending onboarding");
  });

  it("marks live dashboard trainers as active", () => {
    expect(
      resolveTrainerMembershipStatus({
        trainer: { termsAcceptedAt: new Date("2026-06-01T00:00:00.000Z") },
        profile: { hasSignedTOS: true, dashboardActivatedAt: new Date("2026-06-02T00:00:00.000Z") },
      }),
    ).toBe("active");
  });

  it("marks deidentified trainers before other statuses", () => {
    expect(
      resolveTrainerMembershipStatus({
        trainer: {
          termsAcceptedAt: new Date("2026-06-01T00:00:00.000Z"),
          deidentifiedAt: new Date("2026-06-08T00:00:00.000Z"),
        },
        profile: { hasSignedTOS: true, dashboardActivatedAt: null },
      }),
    ).toBe("deidentified");
    expect(trainerMembershipStatusLabel("deidentified")).toBe("Removed (deidentified)");
  });

  it("marks pre-tos trainers separately from pending", () => {
    expect(
      resolveTrainerMembershipStatus({
        trainer: { termsAcceptedAt: null },
        profile: { hasSignedTOS: false, dashboardActivatedAt: null },
      }),
    ).toBe("pre_tos");
  });

  it("searches trainer first and last names", () => {
    expect(buildAdminTrainerSearchClause("Kristian")).toEqual({
      OR: expect.arrayContaining([
        { firstName: { contains: "Kristian", mode: "insensitive" } },
        { lastName: { contains: "Kristian", mode: "insensitive" } },
      ]),
    });
  });

  it("builds complete pending qualifications", () => {
    expect(
      buildTrainerPendingQualifications({
        termsAcceptedAt: new Date("2026-06-01T00:00:00.000Z"),
        profile: {
          hasSignedTOS: true,
          complianceWindowStartedAt: null,
          registrationFeeHoldStatus: "HELD",
          backgroundCheckStatus: "PENDING",
          certificationUrl: "/uploads/cert.pdf",
          certificationReviewStatus: "PENDING",
        },
      }),
    ).toEqual({
      termsAccepted: true,
      complianceWindowStarted: false,
      onboardingFeeCompleted: false,
      onboardingFeeHoldPlaced: true,
      backgroundCheckStatus: "PENDING",
      backgroundCheckReviewStatus: null,
      documentsComplete: false,
      documentsPending: true,
    });
  });

  it("marks onboarding fee completed only when captured or explicitly paid", () => {
    expect(
      buildTrainerPendingQualifications({
        termsAcceptedAt: new Date("2026-06-01T00:00:00.000Z"),
        profile: {
          hasPaidRegistrationFee: true,
          registrationFeeHoldStatus: "HELD",
        },
      }),
    ).toMatchObject({
      onboardingFeeCompleted: true,
      onboardingFeeHoldPlaced: true,
    });

    expect(
      buildTrainerPendingQualifications({
        termsAcceptedAt: new Date("2026-06-01T00:00:00.000Z"),
        profile: {
          registrationFeeHoldStatus: "CAPTURED",
        },
      }),
    ).toMatchObject({
      onboardingFeeCompleted: true,
      onboardingFeeHoldPlaced: true,
    });
  });
});

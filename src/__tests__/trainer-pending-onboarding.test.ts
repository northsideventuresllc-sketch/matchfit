import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  mockTrainerOnboardingFeeDeadlineAt,
  mockTrainerRegistrationPricingModeForNewTrainer,
} = vi.hoisted(() => ({
  prismaMock: {
    trainer: {
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    trainerProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
  mockTrainerOnboardingFeeDeadlineAt: vi.fn(),
  mockTrainerRegistrationPricingModeForNewTrainer: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/trainer-onboarding-fee-deadline", () => ({
  trainerOnboardingFeeDeadlineAt: mockTrainerOnboardingFeeDeadlineAt,
}));

vi.mock("@/lib/trainer-registration-fee", () => ({
  trainerRegistrationPricingModeForNewTrainer: mockTrainerRegistrationPricingModeForNewTrainer,
}));

import {
  markTrainerPendingAfterTermsAcceptance,
  repairStaleTrainerPendingRecords,
} from "@/lib/trainer-pending-onboarding";

describe("trainer pending onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.trainer.update.mockResolvedValue({});
    prismaMock.trainer.findUnique.mockResolvedValue({ platformTrialEndsAt: null });
    prismaMock.trainer.findMany.mockResolvedValue([]);
    prismaMock.trainerProfile.findUnique.mockResolvedValue(null);
    prismaMock.trainerProfile.update.mockResolvedValue({});
    prismaMock.trainerProfile.create.mockResolvedValue({});
    mockTrainerOnboardingFeeDeadlineAt.mockReturnValue(new Date("2026-06-16T00:00:00.000Z"));
    mockTrainerRegistrationPricingModeForNewTrainer.mockReturnValue("FOUNDING_BG_SURCHARGE_20PCT");
  });

  it("updates an existing profile and starts onboarding window when missing", async () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    const deadline = new Date("2026-06-16T00:00:00.000Z");
    const trialEnds = new Date("2026-08-08T00:00:00.000Z");
    mockTrainerOnboardingFeeDeadlineAt.mockReturnValueOnce(deadline);
    prismaMock.trainerProfile.findUnique.mockResolvedValueOnce({
      complianceWindowStartedAt: null,
      limitedDashboardUnlockedAt: null,
      onboardingFeePaymentDeadlineAt: null,
      fitHubPromoEndsAt: null,
    });

    await markTrainerPendingAfterTermsAcceptance("trainer_1", now);

    expect(prismaMock.trainer.update).toHaveBeenCalledWith({
      where: { id: "trainer_1" },
      data: {
        termsAcceptedAt: now,
        privacyPolicyAcceptedAt: now,
        platformTrialEndsAt: trialEnds,
        platformTrialConsumed: false,
      },
    });
    expect(prismaMock.trainerProfile.update).toHaveBeenCalledWith({
      where: { trainerId: "trainer_1" },
      data: {
        hasSignedTOS: true,
        limitedDashboardUnlockedAt: now,
        complianceWindowStartedAt: now,
        onboardingFeePaymentDeadlineAt: deadline,
        fitHubPromoEndsAt: trialEnds,
        updatedAt: now,
      },
    });
    expect(prismaMock.trainerProfile.create).not.toHaveBeenCalled();
  });

  it("does not reset an existing onboarding window", async () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    prismaMock.trainer.findUnique.mockResolvedValueOnce({
      platformTrialEndsAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    prismaMock.trainerProfile.findUnique.mockResolvedValueOnce({
      complianceWindowStartedAt: new Date("2026-06-02T00:00:00.000Z"),
      limitedDashboardUnlockedAt: new Date("2026-06-02T00:00:00.000Z"),
      onboardingFeePaymentDeadlineAt: new Date("2026-06-09T00:00:00.000Z"),
      fitHubPromoEndsAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    await markTrainerPendingAfterTermsAcceptance("trainer_1", now);

    expect(prismaMock.trainer.update).toHaveBeenCalledWith({
      where: { id: "trainer_1" },
      data: {
        termsAcceptedAt: now,
        privacyPolicyAcceptedAt: now,
      },
    });
    expect(prismaMock.trainerProfile.update).toHaveBeenCalledWith({
      where: { trainerId: "trainer_1" },
      data: {
        hasSignedTOS: true,
        updatedAt: now,
      },
    });
    expect(prismaMock.trainerProfile.create).not.toHaveBeenCalled();
  });

  it("creates a pending profile with defaults when profile is missing", async () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    const deadline = new Date("2026-06-16T00:00:00.000Z");
    const trialEnds = new Date("2026-08-08T00:00:00.000Z");
    mockTrainerOnboardingFeeDeadlineAt.mockReturnValueOnce(deadline);
    prismaMock.trainerProfile.findUnique.mockResolvedValueOnce(null);

    await markTrainerPendingAfterTermsAcceptance("trainer_1", now);

    expect(mockTrainerRegistrationPricingModeForNewTrainer).toHaveBeenCalledWith(0);
    expect(prismaMock.trainerProfile.create).toHaveBeenCalledWith({
      data: {
        trainerId: "trainer_1",
        registrationFeeHoldStatus: "NOT_STARTED",
        registrationFeePricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
        complianceCertFailedAttempts: 0,
        hasSignedTOS: true,
        limitedDashboardUnlockedAt: now,
        complianceWindowStartedAt: now,
        onboardingFeePaymentDeadlineAt: deadline,
        fitHubPromoEndsAt: trialEnds,
        updatedAt: now,
      },
    });
    expect(prismaMock.trainerProfile.update).not.toHaveBeenCalled();
  });

  it("repairs only stale pending candidates and uses anchored timestamps", async () => {
    const termsAnchor = new Date("2026-06-04T00:00:00.000Z");
    const createdAnchor = new Date("2026-06-03T00:00:00.000Z");
    prismaMock.trainer.findMany.mockResolvedValueOnce([
      {
        id: "trainer_missing_profile",
        termsAcceptedAt: termsAnchor,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        profile: null,
      },
      {
        id: "trainer_missing_window",
        termsAcceptedAt: null,
        createdAt: createdAnchor,
        profile: {
          hasSignedTOS: true,
          complianceWindowStartedAt: null,
        },
      },
      {
        id: "trainer_not_stale",
        termsAcceptedAt: null,
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        profile: {
          hasSignedTOS: false,
          complianceWindowStartedAt: null,
        },
      },
    ]);
    prismaMock.trainerProfile.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        complianceWindowStartedAt: null,
        limitedDashboardUnlockedAt: null,
        onboardingFeePaymentDeadlineAt: null,
        fitHubPromoEndsAt: null,
      });
    prismaMock.trainer.findUnique
      .mockResolvedValueOnce({ platformTrialEndsAt: null })
      .mockResolvedValueOnce({ platformTrialEndsAt: null });

    const repaired = await repairStaleTrainerPendingRecords(50);

    expect(repaired).toBe(2);
    expect(prismaMock.trainer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
    expect(prismaMock.trainer.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.trainer.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "trainer_missing_profile" },
        data: expect.objectContaining({
          termsAcceptedAt: termsAnchor,
          privacyPolicyAcceptedAt: termsAnchor,
          platformTrialConsumed: false,
        }),
      }),
    );
  });

  it("returns zero when stale repair scan finds no candidates", async () => {
    prismaMock.trainer.findMany.mockResolvedValueOnce([]);

    const repaired = await repairStaleTrainerPendingRecords();

    expect(repaired).toBe(0);
    expect(prismaMock.trainerProfile.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.trainer.update).not.toHaveBeenCalled();
  });
});

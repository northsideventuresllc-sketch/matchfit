import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTrainerFindMany,
  mockTrainerUpdate,
  mockTrainerProfileFindUnique,
  mockTrainerProfileUpdate,
  mockTrainerProfileCreate,
  mockTrainerOnboardingFeeDeadlineAt,
  mockTrainerRegistrationPricingModeForNewTrainer,
} = vi.hoisted(() => ({
  mockTrainerFindMany: vi.fn(),
  mockTrainerUpdate: vi.fn(),
  mockTrainerProfileFindUnique: vi.fn(),
  mockTrainerProfileUpdate: vi.fn(),
  mockTrainerProfileCreate: vi.fn(),
  mockTrainerOnboardingFeeDeadlineAt: vi.fn(),
  mockTrainerRegistrationPricingModeForNewTrainer: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findMany: mockTrainerFindMany,
      update: mockTrainerUpdate,
    },
    trainerProfile: {
      findUnique: mockTrainerProfileFindUnique,
      update: mockTrainerProfileUpdate,
      create: mockTrainerProfileCreate,
    },
  },
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

describe("trainer-pending-onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrainerOnboardingFeeDeadlineAt.mockImplementation((now: Date) => {
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + 7);
      return deadline;
    });
    mockTrainerRegistrationPricingModeForNewTrainer.mockReturnValue("FOUNDING_BG_SURCHARGE_20PCT");
    mockTrainerUpdate.mockResolvedValue({});
    mockTrainerProfileUpdate.mockResolvedValue({});
    mockTrainerProfileCreate.mockResolvedValue({});
    mockTrainerFindMany.mockResolvedValue([]);
  });

  it("updates an existing profile without resetting an already started compliance window", async () => {
    const now = new Date("2026-06-09T12:00:00.000Z");
    mockTrainerProfileFindUnique.mockResolvedValueOnce({
      complianceWindowStartedAt: new Date("2026-06-01T00:00:00.000Z"),
      limitedDashboardUnlockedAt: new Date("2026-06-01T00:00:00.000Z"),
      onboardingFeePaymentDeadlineAt: new Date("2026-06-08T00:00:00.000Z"),
    });

    await markTrainerPendingAfterTermsAcceptance("trainer_existing", now);

    expect(mockTrainerUpdate).toHaveBeenCalledWith({
      where: { id: "trainer_existing" },
      data: {
        termsAcceptedAt: now,
        privacyPolicyAcceptedAt: now,
      },
    });
    expect(mockTrainerProfileUpdate).toHaveBeenCalledWith({
      where: { trainerId: "trainer_existing" },
      data: {
        hasSignedTOS: true,
        updatedAt: now,
      },
    });
    expect(mockTrainerProfileCreate).not.toHaveBeenCalled();
  });

  it("creates a pending profile with hold defaults when no profile exists", async () => {
    const now = new Date("2026-06-09T15:00:00.000Z");
    const expectedDeadline = new Date("2026-06-16T15:00:00.000Z");
    mockTrainerOnboardingFeeDeadlineAt.mockReturnValueOnce(expectedDeadline);
    mockTrainerProfileFindUnique.mockResolvedValueOnce(null);

    await markTrainerPendingAfterTermsAcceptance("trainer_new", now);

    expect(mockTrainerOnboardingFeeDeadlineAt).toHaveBeenCalledWith(now);
    expect(mockTrainerRegistrationPricingModeForNewTrainer).toHaveBeenCalledWith(0);
    expect(mockTrainerProfileCreate).toHaveBeenCalledWith({
      data: {
        trainerId: "trainer_new",
        registrationFeeHoldStatus: "NOT_STARTED",
        registrationFeePricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
        complianceCertFailedAttempts: 0,
        hasSignedTOS: true,
        limitedDashboardUnlockedAt: now,
        complianceWindowStartedAt: now,
        onboardingFeePaymentDeadlineAt: expectedDeadline,
        updatedAt: now,
      },
    });
  });

  it("repairs only stale trainer pending records and returns repaired count", async () => {
    const termsAcceptedAnchor = new Date("2026-06-05T00:00:00.000Z");
    const profileAnchorFallback = new Date("2026-06-03T00:00:00.000Z");
    const alreadyHealthyCreatedAt = new Date("2026-06-01T00:00:00.000Z");
    mockTrainerFindMany.mockResolvedValueOnce([
      {
        id: "trainer_missing_profile",
        termsAcceptedAt: termsAcceptedAnchor,
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        profile: null,
      },
      {
        id: "trainer_missing_compliance_window",
        termsAcceptedAt: null,
        createdAt: profileAnchorFallback,
        profile: {
          hasSignedTOS: true,
          complianceWindowStartedAt: null,
        },
      },
      {
        id: "trainer_healthy",
        termsAcceptedAt: null,
        createdAt: alreadyHealthyCreatedAt,
        profile: {
          hasSignedTOS: false,
          complianceWindowStartedAt: null,
        },
      },
    ]);

    mockTrainerProfileFindUnique.mockImplementation(async ({ where }: { where: { trainerId: string } }) => {
      if (where.trainerId === "trainer_missing_profile") return null;
      if (where.trainerId === "trainer_missing_compliance_window") {
        return {
          complianceWindowStartedAt: null,
          limitedDashboardUnlockedAt: null,
          onboardingFeePaymentDeadlineAt: null,
        };
      }
      return {
        complianceWindowStartedAt: new Date("2026-06-01T00:00:00.000Z"),
        limitedDashboardUnlockedAt: new Date("2026-06-01T00:00:00.000Z"),
        onboardingFeePaymentDeadlineAt: new Date("2026-06-08T00:00:00.000Z"),
      };
    });

    const repaired = await repairStaleTrainerPendingRecords(25);

    expect(mockTrainerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
      }),
    );
    expect(repaired).toBe(2);
    expect(mockTrainerUpdate).toHaveBeenCalledTimes(2);
    expect(mockTrainerUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "trainer_missing_profile" },
      data: {
        termsAcceptedAt: termsAcceptedAnchor,
        privacyPolicyAcceptedAt: termsAcceptedAnchor,
      },
    });
    expect(mockTrainerUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "trainer_missing_compliance_window" },
      data: {
        termsAcceptedAt: profileAnchorFallback,
        privacyPolicyAcceptedAt: profileAnchorFallback,
      },
    });
  });
});

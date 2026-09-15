import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainerProfile: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    trainer: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { processTrainerOnboardingFeeDeadlineExpirations } from "@/lib/trainer-onboarding-fee-deadline-cron";

describe("processTrainerOnboardingFeeDeadlineExpirations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00.000Z"));
    prismaMock.trainerProfile.findMany.mockResolvedValue([]);
    prismaMock.trainerProfile.update.mockResolvedValue({});
    prismaMock.trainer.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zero when no candidate trainer profiles are due", async () => {
    const count = await processTrainerOnboardingFeeDeadlineExpirations();

    expect(prismaMock.trainerProfile.findMany).toHaveBeenCalledWith({
      where: {
        hasSignedTOS: true,
        onboardingFeePaymentDeadlineAt: { not: null },
        onboardingFeePaymentExpiredAt: null,
        registrationFeeHoldStatus: { in: ["NOT_STARTED", "CANCELED"] },
        hasPaidRegistrationFee: false,
      },
      select: {
        trainerId: true,
        onboardingFeePaymentDeadlineAt: true,
        registrationFeeHoldStatus: true,
        hasPaidRegistrationFee: true,
        registrationFeeWaived: true,
      },
    });
    expect(count).toBe(0);
    expect(prismaMock.trainerProfile.update).not.toHaveBeenCalled();
    expect(prismaMock.trainer.update).not.toHaveBeenCalled();
  });

  it("expires only profiles that are currently overdue, and never touches Trainer.deidentifiedAt", async () => {
    prismaMock.trainerProfile.findMany.mockResolvedValueOnce([
      {
        trainerId: "trainer_overdue",
        onboardingFeePaymentDeadlineAt: new Date("2026-06-07T12:00:00.000Z"),
        registrationFeeHoldStatus: "NOT_STARTED",
        hasPaidRegistrationFee: false,
        registrationFeeWaived: false,
      },
      {
        trainerId: "trainer_future",
        onboardingFeePaymentDeadlineAt: new Date("2026-06-09T12:00:00.000Z"),
        registrationFeeHoldStatus: "NOT_STARTED",
        hasPaidRegistrationFee: false,
        registrationFeeWaived: false,
      },
    ]);

    const count = await processTrainerOnboardingFeeDeadlineExpirations();

    expect(count).toBe(1);
    expect(prismaMock.trainerProfile.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.trainerProfile.update).toHaveBeenCalledWith({
      where: { trainerId: "trainer_overdue" },
      data: {
        onboardingFeePaymentExpiredAt: new Date("2026-06-08T12:00:00.000Z"),
        updatedAt: new Date("2026-06-08T12:00:00.000Z"),
      },
    });
    // Regression guard: a fee-deadline expiration must never mark a live, non-deleted
    // trainer as `deidentifiedAt` (see `account-deidentify-core.ts` for the only correct,
    // PII-scrubbing way to set that field) — doing so silently dropped real trainers out of
    // the public founding-trainer counter and every other `deidentifiedAt: null` query.
    expect(prismaMock.trainer.update).not.toHaveBeenCalled();
  });

  it("does not expire a trainer whose onboarding fee is waived, even past the deadline", async () => {
    prismaMock.trainerProfile.findMany.mockResolvedValueOnce([
      {
        trainerId: "trainer_founding_waived",
        onboardingFeePaymentDeadlineAt: new Date("2026-06-07T12:00:00.000Z"),
        registrationFeeHoldStatus: "NOT_STARTED",
        hasPaidRegistrationFee: false,
        registrationFeeWaived: true,
      },
    ]);

    const count = await processTrainerOnboardingFeeDeadlineExpirations();

    expect(count).toBe(0);
    expect(prismaMock.trainerProfile.update).not.toHaveBeenCalled();
    expect(prismaMock.trainer.update).not.toHaveBeenCalled();
  });
});

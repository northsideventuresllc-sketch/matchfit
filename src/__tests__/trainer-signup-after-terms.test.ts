import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainerSignupParsed } from "@/lib/trainer-register-service";

const {
  completeTrainerSupabaseSignupMock,
  createTrainerRecordMock,
  markTrainerWaitlistRegisteredMock,
  sendTrainerWelcomeEmailMock,
  resolveTrainerSignupNextPathMock,
  prismaMock,
  txMock,
} = vi.hoisted(() => {
  const txMock = {
    trainer: { update: vi.fn() },
    trainerProfile: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  };
  return {
    completeTrainerSupabaseSignupMock: vi.fn(),
    createTrainerRecordMock: vi.fn(),
    markTrainerWaitlistRegisteredMock: vi.fn(),
    sendTrainerWelcomeEmailMock: vi.fn(),
    resolveTrainerSignupNextPathMock: vi.fn(),
    prismaMock: {
      $transaction: vi.fn(),
      trainerProfile: {
        findUnique: vi.fn(),
      },
    },
    txMock,
  };
});

vi.mock("@/lib/complete-trainer-supabase-signup", () => ({
  completeTrainerSupabaseSignup: completeTrainerSupabaseSignupMock,
}));

vi.mock("@/lib/trainer-register-service", () => ({
  createTrainerRecord: createTrainerRecordMock,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  markTrainerWaitlistRegistered: markTrainerWaitlistRegisteredMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/trainer-welcome-email", () => ({
  sendTrainerWelcomeEmail: sendTrainerWelcomeEmailMock,
}));

vi.mock("@/lib/trainer-signup-next-path", () => ({
  resolveTrainerSignupNextPath: resolveTrainerSignupNextPathMock,
}));

import { createTrainerAccountAfterTermsAcceptance } from "@/lib/trainer-signup-after-terms";

const signupBody: TrainerSignupParsed = {
  firstName: "Jon",
  lastName: "Booth",
  username: "coachjon",
  phone: "4045550100",
  email: "coach@example.com",
  password: "TestPass1!",
  agreedToTerms: true,
  stayLoggedIn: true,
  serviceZipCode: "30301",
  betaInviteToken: "invite_1",
};

describe("createTrainerAccountAfterTermsAcceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T15:00:00.000Z"));

    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    txMock.trainerProfile.findUnique.mockResolvedValue({
      complianceWindowStartedAt: null,
      limitedDashboardUnlockedAt: null,
      onboardingFeePaymentDeadlineAt: null,
    });
    prismaMock.trainerProfile.findUnique.mockResolvedValue({
      hasSignedTOS: true,
      registrationFeeHoldStatus: "NOT_STARTED",
      hasPaidRegistrationFee: false,
      limitedDashboardUnlockedAt: new Date("2026-06-08T15:00:00.000Z"),
      onboardingFeePaymentDeadlineAt: new Date("2026-06-15T15:00:00.000Z"),
      onboardingFeePaymentExpiredAt: null,
    });

    completeTrainerSupabaseSignupMock.mockResolvedValue({ ok: true, trainerId: "", next: "/trainer/signup/terms" });
    createTrainerRecordMock.mockResolvedValue({ id: "trainer_1", email: "coach@example.com" });
    resolveTrainerSignupNextPathMock.mockReturnValue("/trainer/dashboard");
    sendTrainerWelcomeEmailMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns early when pre-signup validation fails", async () => {
    completeTrainerSupabaseSignupMock.mockResolvedValueOnce({
      ok: false,
      error: "Confirm your email first.",
      code: "EMAIL_NOT_CONFIRMED",
      status: 403,
    });

    const result = await createTrainerAccountAfterTermsAcceptance(signupBody);

    expect(result).toEqual({
      ok: false,
      error: "Confirm your email first.",
      code: "EMAIL_NOT_CONFIRMED",
      status: 403,
    });
    expect(createTrainerRecordMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("creates trainer records, starts onboarding deadline, and returns next path", async () => {
    const result = await createTrainerAccountAfterTermsAcceptance(signupBody, {
      betaInviteEntryId: "entry_1",
    });

    expect(completeTrainerSupabaseSignupMock).toHaveBeenCalledWith(signupBody, { createAccount: false });
    expect(createTrainerRecordMock).toHaveBeenCalledWith(signupBody, {
      betaInviteEntryId: "entry_1",
    });
    expect(txMock.trainer.update).toHaveBeenCalledWith({
      where: { id: "trainer_1" },
      data: {
        termsAcceptedAt: new Date("2026-06-08T15:00:00.000Z"),
        privacyPolicyAcceptedAt: new Date("2026-06-08T15:00:00.000Z"),
      },
    });
    expect(txMock.trainerProfile.update).toHaveBeenCalledWith({
      where: { trainerId: "trainer_1" },
      data: {
        hasSignedTOS: true,
        limitedDashboardUnlockedAt: new Date("2026-06-08T15:00:00.000Z"),
        complianceWindowStartedAt: new Date("2026-06-08T15:00:00.000Z"),
        onboardingFeePaymentDeadlineAt: new Date("2026-06-15T15:00:00.000Z"),
        updatedAt: new Date("2026-06-08T15:00:00.000Z"),
      },
    });
    expect(markTrainerWaitlistRegisteredMock).toHaveBeenCalledWith("entry_1", "trainer_1");
    expect(sendTrainerWelcomeEmailMock).toHaveBeenCalledWith({
      to: "coach@example.com",
      firstName: "Jon",
      trainerId: "trainer_1",
    });
    expect(result).toEqual({
      ok: true,
      trainerId: "trainer_1",
      email: "coach@example.com",
      firstName: "Jon",
      next: "/trainer/dashboard",
    });
  });

  it("does not fail the signup when welcome email sending fails", async () => {
    sendTrainerWelcomeEmailMock.mockRejectedValueOnce(new Error("smtp unavailable"));

    const result = await createTrainerAccountAfterTermsAcceptance(signupBody);

    expect(result).toMatchObject({
      ok: true,
      trainerId: "trainer_1",
      next: "/trainer/dashboard",
    });
  });
});

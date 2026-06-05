import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  createSupabaseAdminClientMock,
  adminAuthMock,
  evaluateBetaTrainerRegistrationGateMock,
  isTrainerUsernameTakenMock,
  isTrainerEmailTakenMock,
  createTrainerRecordMock,
  markTrainerWaitlistRegisteredMock,
  sendTrainerWelcomeEmailMock,
} = vi.hoisted(() => {
  const adminAuthMock = {
    updateUserById: vi.fn(),
  };
  return {
    prismaMock: { $queryRaw: vi.fn(), trainerProfile: { findUnique: vi.fn() } },
    createSupabaseAdminClientMock: vi.fn(() => ({ auth: { admin: adminAuthMock } })),
    adminAuthMock,
    evaluateBetaTrainerRegistrationGateMock: vi.fn(),
    isTrainerUsernameTakenMock: vi.fn(),
    isTrainerEmailTakenMock: vi.fn(),
    createTrainerRecordMock: vi.fn(),
    markTrainerWaitlistRegisteredMock: vi.fn(),
    sendTrainerWelcomeEmailMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/supabase/admin-client", () => ({
  isSupabaseAdminConfigured: () => true,
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));
vi.mock("@/lib/beta-trainer-register-gate", () => ({
  evaluateBetaTrainerRegistrationGate: evaluateBetaTrainerRegistrationGateMock,
}));
vi.mock("@/lib/trainer-queries", () => ({
  isTrainerUsernameTaken: isTrainerUsernameTakenMock,
  isTrainerEmailTaken: isTrainerEmailTakenMock,
}));
vi.mock("@/lib/trainer-register-service", () => ({
  createTrainerRecord: createTrainerRecordMock,
}));
vi.mock("@/lib/beta-waitlist-service", () => ({
  markTrainerWaitlistRegistered: markTrainerWaitlistRegisteredMock,
}));
vi.mock("@/lib/trainer-welcome-email", () => ({
  sendTrainerWelcomeEmail: sendTrainerWelcomeEmailMock,
}));

import { completeTrainerSupabaseSignup } from "@/lib/complete-trainer-supabase-signup";

const body = {
  firstName: "Jon",
  lastName: "Booth",
  username: "coachjon",
  phone: "4045550100",
  email: "jb@northsideventuresgroup.com",
  password: "TestPass1!",
  stayLoggedIn: true,
  serviceZipCode: "30301",
};

describe("completeTrainerSupabaseSignup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateBetaTrainerRegistrationGateMock.mockResolvedValue({ ok: true, betaInviteEntryId: null });
    isTrainerUsernameTakenMock.mockResolvedValue(false);
    isTrainerEmailTakenMock.mockResolvedValue(false);
    prismaMock.$queryRaw.mockResolvedValue([{ id: "auth_user_1", email_confirmed_at: new Date("2026-01-01") }]);
    createTrainerRecordMock.mockResolvedValue({ id: "trainer_1", email: body.email });
    prismaMock.trainerProfile.findUnique.mockResolvedValue({
      hasSignedTOS: false,
      registrationFeeHoldStatus: null,
      hasPaidRegistrationFee: false,
      limitedDashboardUnlockedAt: null,
    });
    adminAuthMock.updateUserById.mockResolvedValue({ error: null });
    sendTrainerWelcomeEmailMock.mockResolvedValue(undefined);
  });

  it("creates trainer after syncing password for a confirmed Supabase user", async () => {
    const result = await completeTrainerSupabaseSignup(body);
    expect(result).toMatchObject({ ok: true, trainerId: "trainer_1" });
    expect(createTrainerRecordMock).toHaveBeenCalledOnce();
    expect(adminAuthMock.updateUserById).toHaveBeenCalledTimes(2);
    expect(adminAuthMock.updateUserById).toHaveBeenNthCalledWith(1, "auth_user_1", {
      password: body.password,
    });
  });

  it("rejects when email is not confirmed yet", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "auth_user_1", email_confirmed_at: null }]);
    const result = await completeTrainerSupabaseSignup(body);
    expect(result).toMatchObject({ ok: false, code: "EMAIL_NOT_CONFIRMED", status: 403 });
    expect(createTrainerRecordMock).not.toHaveBeenCalled();
  });
});

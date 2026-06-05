import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  createSupabaseAdminClientMock,
  adminAuthMock,
  createClientMock,
  signInWithPasswordMock,
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
  const signInWithPasswordMock = vi.fn();
  return {
    prismaMock: { $queryRaw: vi.fn(), trainerProfile: { findUnique: vi.fn() } },
    createSupabaseAdminClientMock: vi.fn(() => ({ auth: { admin: adminAuthMock } })),
    adminAuthMock,
    createClientMock: vi.fn(() => ({ auth: { signInWithPassword: signInWithPasswordMock } })),
    signInWithPasswordMock,
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
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    evaluateBetaTrainerRegistrationGateMock.mockResolvedValue({ ok: true, betaInviteEntryId: null });
    isTrainerUsernameTakenMock.mockResolvedValue(false);
    isTrainerEmailTakenMock.mockResolvedValue(false);
    prismaMock.$queryRaw.mockResolvedValue([{ id: "auth_user_1" }]);
    signInWithPasswordMock.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
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

  it("creates trainer after server-side Supabase password check", async () => {
    const result = await completeTrainerSupabaseSignup(body);
    expect(result).toMatchObject({ ok: true, trainerId: "trainer_1" });
    expect(createTrainerRecordMock).toHaveBeenCalledOnce();
    expect(adminAuthMock.updateUserById).toHaveBeenCalledOnce();
  });
});

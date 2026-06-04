import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, ensureClientPlatformTrialSchemaMock, assertClientBetaSlotForFinalizeMock } =
  vi.hoisted(() => ({
    prismaMock: {
      client: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      betaClientWaitlistEntry: {
        updateMany: vi.fn(),
      },
    },
    ensureClientPlatformTrialSchemaMock: vi.fn(),
    assertClientBetaSlotForFinalizeMock: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ensure-client-platform-trial-schema", () => ({
  ensureClientPlatformTrialSchema: ensureClientPlatformTrialSchemaMock,
  isMissingClientPlatformTrialColumnError: () => false,
}));
vi.mock("@/lib/beta-cap-enforcement", () => ({
  assertClientBetaSlotForFinalize: assertClientBetaSlotForFinalizeMock,
  BetaCapExceededError: class BetaCapExceededError extends Error {
    code = "BETA_CLIENT_CAP";
  },
}));
vi.mock("@/lib/client-membership-email-notify", () => ({
  notifyClientMembershipTrialStarted: vi.fn(),
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
}));

import { finalizeClientRegistrationFromSignup } from "@/lib/client-register-finalize";

const body = {
  firstName: "Test",
  lastName: "User",
  preferredName: "Test",
  username: "newclient",
  phone: "4045550100",
  email: "newclient@example.com",
  password: "TestPass1!",
  zipCode: "30301",
  dateOfBirth: "1990-01-01",
  agreedToTerms: true,
  stayLoggedIn: true,
};

describe("finalizeClientRegistrationFromSignup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureClientPlatformTrialSchemaMock.mockResolvedValue(undefined);
    assertClientBetaSlotForFinalizeMock.mockResolvedValue(undefined);
    prismaMock.client.create.mockResolvedValue({ id: "client_123" });
  });

  it("creates a client with stripeBillingLiveMode false (not null)", async () => {
    const result = await finalizeClientRegistrationFromSignup(body, {
      betaClientWaitlistEntryId: null,
      twoFactorEnabled: false,
      twoFactorMethod: "NONE",
      passwordHash: "hashed",
    });

    expect(result).toEqual({ ok: true, clientId: "client_123" });
    expect(prismaMock.client.create).toHaveBeenCalledOnce();
    const createArgs = prismaMock.client.create.mock.calls[0]?.[0];
    expect(createArgs?.data?.stripeBillingLiveMode).toBe(false);
    expect(createArgs?.data?.stripeBillingLiveMode).not.toBeNull();
  });
});

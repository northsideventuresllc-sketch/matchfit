import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetStripe,
  mockStripeObjectIsLiveBilling,
  mockAssertClientBetaSlotForFinalize,
  mockNotifyClientMembershipTrialStarted,
  mockGetClientFoundingTrialDays,
  mockClientFindFirst,
  mockClientFindUnique,
  mockPendingClientRegistrationFindUnique,
  mockPendingClientRegistrationDeleteMany,
  mockPrismaTransaction,
  mockClientCreate,
  mockPendingClientRegistrationDelete,
  mockBetaClientWaitlistUpdateMany,
  mockStripeRetrieve,
} = vi.hoisted(() => ({
  mockGetStripe: vi.fn(),
  mockStripeObjectIsLiveBilling: vi.fn(),
  mockAssertClientBetaSlotForFinalize: vi.fn(),
  mockNotifyClientMembershipTrialStarted: vi.fn(),
  mockGetClientFoundingTrialDays: vi.fn(),
  mockClientFindFirst: vi.fn(),
  mockClientFindUnique: vi.fn(),
  mockPendingClientRegistrationFindUnique: vi.fn(),
  mockPendingClientRegistrationDeleteMany: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockClientCreate: vi.fn(),
  mockPendingClientRegistrationDelete: vi.fn(),
  mockBetaClientWaitlistUpdateMany: vi.fn(),
  mockStripeRetrieve: vi.fn(),
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
  stripeObjectIsLiveBilling: mockStripeObjectIsLiveBilling,
}));

vi.mock("@/lib/beta-cap-enforcement", () => ({
  BetaCapExceededError: class BetaCapExceededError extends Error {},
  assertClientBetaSlotForFinalize: mockAssertClientBetaSlotForFinalize,
}));

vi.mock("@/lib/client-membership-email-notify", () => ({
  notifyClientMembershipTrialStarted: mockNotifyClientMembershipTrialStarted,
}));

vi.mock("@/lib/match-fit-launch-promotions", () => ({
  getClientFoundingTrialDays: mockGetClientFoundingTrialDays,
}));

vi.mock("@/lib/match-fit-internal-qa", () => ({
  isMatchFitInternalQaClientEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findFirst: mockClientFindFirst,
      findUnique: mockClientFindUnique,
    },
    pendingClientRegistration: {
      findUnique: mockPendingClientRegistrationFindUnique,
      deleteMany: mockPendingClientRegistrationDeleteMany,
    },
    $transaction: mockPrismaTransaction,
  },
}));

import { finalizeRegistrationAfterPayment } from "@/lib/billing-finalize";

describe("finalizeRegistrationAfterPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientFoundingTrialDays.mockReturnValue(14);
    mockNotifyClientMembershipTrialStarted.mockResolvedValue(undefined);
    mockStripeObjectIsLiveBilling.mockImplementation((livemode: boolean) => livemode === true);

    mockStripeRetrieve.mockResolvedValue({
      status: "active",
      metadata: { holdId: "hold_1" },
      customer: "cus_123",
      livemode: true,
    });
    mockGetStripe.mockReturnValue({
      subscriptions: {
        retrieve: mockStripeRetrieve,
      },
    });

    mockClientFindFirst.mockResolvedValue(null);
    mockClientFindUnique.mockResolvedValue(null);
    mockPendingClientRegistrationFindUnique.mockResolvedValue({
      id: "hold_1",
      firstName: "Alex",
      lastName: "Member",
      preferredName: null,
      username: "alexmember",
      phone: "555-555-0100",
      email: "alex@example.com",
      passwordHash: "hash_123",
      zipCode: "90001",
      dateOfBirth: new Date("1992-01-01T00:00:00.000Z"),
      termsAcceptedAt: new Date("2026-05-20T00:00:00.000Z"),
      privacyPolicyAcceptedAt: null,
      twoFactorEnabled: true,
      twoFactorMethod: "SMS",
      stayLoggedIn: true,
      stripeSubscriptionId: null,
      betaClientWaitlistEntryId: null,
      status: "AWAITING_PAYMENT",
    });
    mockPendingClientRegistrationDeleteMany.mockResolvedValue({ count: 0 });

    mockClientCreate.mockResolvedValue({ id: "client_123" });
    mockPendingClientRegistrationDelete.mockResolvedValue({});
    mockBetaClientWaitlistUpdateMany.mockResolvedValue({ count: 0 });
    mockAssertClientBetaSlotForFinalize.mockResolvedValue(undefined);

    mockPrismaTransaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) =>
      cb({
        client: {
          create: mockClientCreate,
        },
        pendingClientRegistration: {
          delete: mockPendingClientRegistrationDelete,
        },
        betaClientWaitlistEntry: {
          updateMany: mockBetaClientWaitlistUpdateMany,
        },
      }),
    );
  });

  it("returns a clear error when Stripe billing is not configured", async () => {
    mockGetStripe.mockReturnValueOnce(null);

    await expect(finalizeRegistrationAfterPayment("sub_no_stripe")).resolves.toEqual({
      ok: false,
      error: "Billing is not configured.",
    });
    expect(mockStripeRetrieve).not.toHaveBeenCalled();
  });

  it("persists stripe live-billing mode when creating a client account", async () => {
    await expect(finalizeRegistrationAfterPayment("sub_live_123")).resolves.toEqual({
      ok: true,
      clientId: "client_123",
    });

    expect(mockStripeObjectIsLiveBilling).toHaveBeenCalledWith(true);
    const createArgs = mockClientCreate.mock.calls[0]?.[0] as {
      data: {
        stripeCustomerId: string;
        stripeSubscriptionId: string;
        stripeSubscriptionActive: boolean;
        stripeBillingLiveMode: boolean;
      };
    };
    expect(createArgs.data.stripeCustomerId).toBe("cus_123");
    expect(createArgs.data.stripeSubscriptionId).toBe("sub_live_123");
    expect(createArgs.data.stripeSubscriptionActive).toBe(true);
    expect(createArgs.data.stripeBillingLiveMode).toBe(true);
  });
});

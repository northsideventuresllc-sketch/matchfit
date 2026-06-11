import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClientFindUnique,
  mockTrainerFindUnique,
  mockPrismaTransaction,
  mockClientTwoFactorDeleteMany,
  mockWebPushDeleteMany,
  mockConversationFindMany,
  mockChatUpdateMany,
  mockClientUpdate,
  mockTrainerTwoFactorDeleteMany,
  mockTrainerFitHubPostUpdateMany,
  mockTrainerProfileUpdateMany,
  mockTrainerUpdate,
  mockHashPassword,
  mockGetStripe,
  mockPromoteBetaWaitlistIfCapacity,
} = vi.hoisted(() => ({
  mockClientFindUnique: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockPrismaTransaction: vi.fn(),
  mockClientTwoFactorDeleteMany: vi.fn(),
  mockWebPushDeleteMany: vi.fn(),
  mockConversationFindMany: vi.fn(),
  mockChatUpdateMany: vi.fn(),
  mockClientUpdate: vi.fn(),
  mockTrainerTwoFactorDeleteMany: vi.fn(),
  mockTrainerFitHubPostUpdateMany: vi.fn(),
  mockTrainerProfileUpdateMany: vi.fn(),
  mockTrainerUpdate: vi.fn(),
  mockHashPassword: vi.fn(),
  mockGetStripe: vi.fn(),
  mockPromoteBetaWaitlistIfCapacity: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: mockClientFindUnique,
    },
    trainer: {
      findUnique: mockTrainerFindUnique,
    },
    $transaction: mockPrismaTransaction,
  },
}));

vi.mock("@/lib/password", () => ({
  hashPassword: mockHashPassword,
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  promoteBetaWaitlistIfCapacity: mockPromoteBetaWaitlistIfCapacity,
}));

import { deidentifyClientAccount, deidentifyTrainerAccount } from "@/lib/account-deletion";

describe("account-deletion deidentify helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockHashPassword.mockResolvedValue("hashed-password");
    mockPromoteBetaWaitlistIfCapacity.mockResolvedValue(undefined);
    mockGetStripe.mockReturnValue(undefined);
    mockTrainerFindUnique.mockResolvedValue({ id: "trainer_exists" });

    mockClientTwoFactorDeleteMany.mockResolvedValue({ count: 0 });
    mockWebPushDeleteMany.mockResolvedValue({ count: 0 });
    mockConversationFindMany.mockResolvedValue([]);
    mockChatUpdateMany.mockResolvedValue({ count: 0 });
    mockClientUpdate.mockResolvedValue({});
    mockTrainerTwoFactorDeleteMany.mockResolvedValue({ count: 0 });
    mockTrainerFitHubPostUpdateMany.mockResolvedValue({ count: 0 });
    mockTrainerProfileUpdateMany.mockResolvedValue({ count: 0 });
    mockTrainerUpdate.mockResolvedValue({});

    mockPrismaTransaction.mockImplementation(
      async (cb: (tx: Record<string, unknown>) => Promise<void>) =>
        cb({
          clientTwoFactorChannel: { deleteMany: mockClientTwoFactorDeleteMany },
          webPushSubscription: { deleteMany: mockWebPushDeleteMany },
          trainerClientConversation: { findMany: mockConversationFindMany },
          trainerClientChatMessage: { updateMany: mockChatUpdateMany },
          client: { update: mockClientUpdate },
          trainerTwoFactorChannel: { deleteMany: mockTrainerTwoFactorDeleteMany },
          trainerFitHubPost: { updateMany: mockTrainerFitHubPostUpdateMany },
          trainerProfile: { updateMany: mockTrainerProfileUpdateMany },
          trainer: { update: mockTrainerUpdate },
        }),
    );
  });

  it("returns early when client is missing", async () => {
    mockClientFindUnique.mockResolvedValueOnce(null);

    await expect(deidentifyClientAccount("missing_client")).resolves.toBeUndefined();

    expect(mockPrismaTransaction).not.toHaveBeenCalled();
    expect(mockPromoteBetaWaitlistIfCapacity).not.toHaveBeenCalled();
  });

  it("deidentifies client data, redacts client chat messages, and cancels stripe artifacts", async () => {
    const cancelSub = vi.fn().mockResolvedValue(undefined);
    const deleteCustomer = vi.fn().mockResolvedValue(undefined);
    mockGetStripe.mockReturnValue({
      subscriptions: { cancel: cancelSub },
      customers: { del: deleteCustomer },
    });
    mockClientFindUnique.mockResolvedValueOnce({
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
    });
    mockConversationFindMany.mockResolvedValueOnce([{ id: "conv_1" }, { id: "conv_2" }]);

    await expect(deidentifyClientAccount("client_123")).resolves.toBeUndefined();

    expect(cancelSub).toHaveBeenCalledWith("sub_123");
    expect(deleteCustomer).toHaveBeenCalledWith("cus_123");
    expect(mockClientTwoFactorDeleteMany).toHaveBeenCalledWith({ where: { clientId: "client_123" } });
    expect(mockWebPushDeleteMany).toHaveBeenCalledWith({ where: { clientId: "client_123" } });
    expect(mockChatUpdateMany).toHaveBeenCalledWith({
      where: {
        authorRole: "CLIENT",
        conversationId: { in: ["conv_1", "conv_2"] },
      },
      data: { body: "[This message was removed when the account was deleted.]" },
    });

    const updateArgs = mockClientUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: {
        username: string;
        email: string;
        deidentifiedAt: Date;
        passwordHash: string;
        stripeBillingLiveMode: boolean;
        accountDeletionRequestedAt: null;
        accountDeletionFinalizeAt: null;
      };
    };
    expect(updateArgs.where.id).toBe("client_123");
    expect(updateArgs.data.deidentifiedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.passwordHash).toBe("hashed-password");
    expect(updateArgs.data.username).toMatch(/^delc_[a-f0-9]+$/);
    expect(updateArgs.data.username.length).toBeLessThanOrEqual(32);
    expect(updateArgs.data.email).toMatch(/^removed\.client\.[a-z0-9]+\.[a-f0-9]{8}@account-removed\.invalid$/);
    expect(updateArgs.data.stripeBillingLiveMode).toBe(false);
    expect(updateArgs.data.accountDeletionRequestedAt).toBeNull();
    expect(updateArgs.data.accountDeletionFinalizeAt).toBeNull();

    const hashInput = mockHashPassword.mock.calls[0]?.[0] as string;
    expect(hashInput).toMatch(/^[a-f0-9]{64}$/);
    expect(mockPromoteBetaWaitlistIfCapacity).toHaveBeenCalledTimes(1);
  });

  it("continues deidentification when stripe cancellation APIs fail", async () => {
    const cancelSub = vi.fn().mockRejectedValue(new Error("already canceled"));
    const deleteCustomer = vi.fn().mockRejectedValue(new Error("customer locked"));
    mockGetStripe.mockReturnValue({
      subscriptions: { cancel: cancelSub },
      customers: { del: deleteCustomer },
    });
    mockClientFindUnique.mockResolvedValueOnce({
      stripeCustomerId: "cus_fail",
      stripeSubscriptionId: "sub_fail",
    });

    await expect(deidentifyClientAccount("client_fail")).resolves.toBeUndefined();

    expect(cancelSub).toHaveBeenCalledWith("sub_fail");
    expect(deleteCustomer).toHaveBeenCalledWith("cus_fail");
    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
  });

  it("deidentifies trainer data and associated profile/feed records", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce({ id: "trainer_123" });
    mockConversationFindMany.mockResolvedValueOnce([{ id: "conv_tr_1" }]);

    await expect(deidentifyTrainerAccount("trainer_123")).resolves.toBeUndefined();

    expect(mockTrainerTwoFactorDeleteMany).toHaveBeenCalledWith({ where: { trainerId: "trainer_123" } });
    expect(mockWebPushDeleteMany).toHaveBeenCalledWith({ where: { trainerId: "trainer_123" } });
    expect(mockChatUpdateMany).toHaveBeenCalledWith({
      where: {
        authorRole: "TRAINER",
        conversationId: { in: ["conv_tr_1"] },
      },
      data: { body: "[This message was removed when the account was deleted.]" },
    });
    expect(mockTrainerFitHubPostUpdateMany).toHaveBeenCalledWith({
      where: { trainerId: "trainer_123" },
      data: {
        visibility: "PRIVATE",
        caption: null,
        bodyText: null,
        mediaUrl: null,
        mediaUrlsJson: null,
        hashtagsJson: null,
      },
    });
    expect(mockTrainerProfileUpdateMany).toHaveBeenCalledWith({
      where: { trainerId: "trainer_123" },
      data: {
        w9Json: null,
        w9SelfServeEmailOtpHash: null,
        w9SelfServeEmailOtpExpires: null,
        aiMatchProfileText: null,
        matchQuestionnaireAnswers: null,
        followUpQuestionnaireAnswersJson: null,
        certificationUrl: null,
        otherCertificationUrl: null,
        nutritionistCertificationUrl: null,
        specialistCertificationUrl: null,
        serviceOfferingsJson: null,
        fitHubStudioActivityReadKeysJson: null,
      },
    });

    const trainerUpdateArgs = mockTrainerUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: {
        username: string;
        email: string;
        passwordHash: string;
        deidentifiedAt: Date;
        accountDeletionRequestedAt: null;
        accountDeletionFinalizeAt: null;
      };
    };
    expect(trainerUpdateArgs.where.id).toBe("trainer_123");
    expect(trainerUpdateArgs.data.deidentifiedAt).toBeInstanceOf(Date);
    expect(trainerUpdateArgs.data.passwordHash).toBe("hashed-password");
    expect(trainerUpdateArgs.data.username).toMatch(/^delt_[a-f0-9]+$/);
    expect(trainerUpdateArgs.data.username.length).toBeLessThanOrEqual(32);
    expect(trainerUpdateArgs.data.email).toMatch(/^removed\.trainer\.[a-z0-9]+\.[a-f0-9]{8}@account-removed\.invalid$/);
    expect(trainerUpdateArgs.data.accountDeletionRequestedAt).toBeNull();
    expect(trainerUpdateArgs.data.accountDeletionFinalizeAt).toBeNull();

    expect(mockPromoteBetaWaitlistIfCapacity).toHaveBeenCalledTimes(1);
  });

  it("skips trainer chat redaction when no conversations exist", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce({ id: "trainer_no_convos" });
    mockConversationFindMany.mockResolvedValueOnce([]);

    await expect(deidentifyTrainerAccount("trainer_no_convos")).resolves.toBeUndefined();

    expect(mockChatUpdateMany).not.toHaveBeenCalled();
    expect(mockTrainerUpdate).toHaveBeenCalledTimes(1);
  });
});

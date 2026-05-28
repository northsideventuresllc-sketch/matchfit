import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTransaction,
  mockConversationFindMany,
  mockDeferredOfficialChatDeleteMany,
  mockTrainerClientChatMessageDeleteMany,
  mockTrainerClientConversationDeleteMany,
  mockTrainerClientNudgeDeleteMany,
  mockClientSavedTrainerDeleteMany,
  mockClientTrainerBrowsePassDeleteMany,
  mockWebPushSubscriptionDeleteMany,
  mockClientTwoFactorChannelDeleteMany,
  mockClientUpdate,
  mockTrainerDiscoverMatchBatchDeleteMany,
  mockTrainerTwoFactorChannelDeleteMany,
  mockTrainerProfileUpdateMany,
  mockTrainerUpdate,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockConversationFindMany: vi.fn(),
  mockDeferredOfficialChatDeleteMany: vi.fn(),
  mockTrainerClientChatMessageDeleteMany: vi.fn(),
  mockTrainerClientConversationDeleteMany: vi.fn(),
  mockTrainerClientNudgeDeleteMany: vi.fn(),
  mockClientSavedTrainerDeleteMany: vi.fn(),
  mockClientTrainerBrowsePassDeleteMany: vi.fn(),
  mockWebPushSubscriptionDeleteMany: vi.fn(),
  mockClientTwoFactorChannelDeleteMany: vi.fn(),
  mockClientUpdate: vi.fn(),
  mockTrainerDiscoverMatchBatchDeleteMany: vi.fn(),
  mockTrainerTwoFactorChannelDeleteMany: vi.fn(),
  mockTrainerProfileUpdateMany: vi.fn(),
  mockTrainerUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

import { resetInternalQaClientAccount, resetInternalQaTrainerAccount } from "@/lib/internal-qa-account-reset";

function makeTransactionClient() {
  return {
    trainerClientConversation: {
      findMany: mockConversationFindMany,
      deleteMany: mockTrainerClientConversationDeleteMany,
    },
    internalQaDeferredOfficialChat: {
      deleteMany: mockDeferredOfficialChatDeleteMany,
    },
    trainerClientChatMessage: {
      deleteMany: mockTrainerClientChatMessageDeleteMany,
    },
    trainerClientNudge: {
      deleteMany: mockTrainerClientNudgeDeleteMany,
    },
    clientSavedTrainer: {
      deleteMany: mockClientSavedTrainerDeleteMany,
    },
    clientTrainerBrowsePass: {
      deleteMany: mockClientTrainerBrowsePassDeleteMany,
    },
    webPushSubscription: {
      deleteMany: mockWebPushSubscriptionDeleteMany,
    },
    clientTwoFactorChannel: {
      deleteMany: mockClientTwoFactorChannelDeleteMany,
    },
    client: {
      update: mockClientUpdate,
    },
    trainerDiscoverMatchBatch: {
      deleteMany: mockTrainerDiscoverMatchBatchDeleteMany,
    },
    trainerTwoFactorChannel: {
      deleteMany: mockTrainerTwoFactorChannelDeleteMany,
    },
    trainerProfile: {
      updateMany: mockTrainerProfileUpdateMany,
    },
    trainer: {
      update: mockTrainerUpdate,
    },
  };
}

describe("internal-qa-account-reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(makeTransactionClient()),
    );
    mockConversationFindMany.mockResolvedValue([]);
    mockDeferredOfficialChatDeleteMany.mockResolvedValue({ count: 0 });
    mockTrainerClientChatMessageDeleteMany.mockResolvedValue({ count: 0 });
    mockTrainerClientConversationDeleteMany.mockResolvedValue({ count: 0 });
    mockTrainerClientNudgeDeleteMany.mockResolvedValue({ count: 0 });
    mockClientSavedTrainerDeleteMany.mockResolvedValue({ count: 0 });
    mockClientTrainerBrowsePassDeleteMany.mockResolvedValue({ count: 0 });
    mockWebPushSubscriptionDeleteMany.mockResolvedValue({ count: 0 });
    mockClientTwoFactorChannelDeleteMany.mockResolvedValue({ count: 0 });
    mockClientUpdate.mockResolvedValue({});
    mockTrainerDiscoverMatchBatchDeleteMany.mockResolvedValue({ count: 0 });
    mockTrainerTwoFactorChannelDeleteMany.mockResolvedValue({ count: 0 });
    mockTrainerProfileUpdateMany.mockResolvedValue({ count: 1 });
    mockTrainerUpdate.mockResolvedValue({});
  });

  it("resets client profile and billing fields, including stripeBillingLiveMode", async () => {
    mockConversationFindMany.mockResolvedValueOnce([{ id: "conv_1" }, { id: "conv_2" }]);

    await resetInternalQaClientAccount("client_123");

    expect(mockConversationFindMany).toHaveBeenCalledWith({
      where: { clientId: "client_123" },
      select: { id: true },
    });
    expect(mockDeferredOfficialChatDeleteMany).toHaveBeenCalledWith({
      where: { conversationId: { in: ["conv_1", "conv_2"] } },
    });
    expect(mockTrainerClientChatMessageDeleteMany).toHaveBeenCalledWith({
      where: { conversationId: { in: ["conv_1", "conv_2"] } },
    });
    expect(mockTrainerClientConversationDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["conv_1", "conv_2"] } },
    });
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_123" },
      data: expect.objectContaining({
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeSubscriptionActive: false,
        stripeBillingLiveMode: false,
        subscriptionGraceUntil: null,
        stripeLastSubscriptionInvoicePaidAt: null,
        allowTrainerDiscovery: true,
      }),
    });
  });

  it("skips conversation cleanup when no client conversations are found", async () => {
    mockConversationFindMany.mockResolvedValueOnce([]);

    await resetInternalQaClientAccount("client_no_conversations");

    expect(mockDeferredOfficialChatDeleteMany).not.toHaveBeenCalled();
    expect(mockTrainerClientChatMessageDeleteMany).not.toHaveBeenCalled();
    expect(mockTrainerClientConversationDeleteMany).not.toHaveBeenCalled();
    expect(mockTrainerClientNudgeDeleteMany).toHaveBeenCalledWith({ where: { clientId: "client_no_conversations" } });
    expect(mockClientSavedTrainerDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client_no_conversations" },
    });
    expect(mockClientTrainerBrowsePassDeleteMany).toHaveBeenCalledWith({
      where: { clientId: "client_no_conversations" },
    });
  });

  it("resets trainer onboarding/profile state and deletes conversation graph data", async () => {
    mockConversationFindMany.mockResolvedValueOnce([{ id: "trainer_conv_1" }]);

    await resetInternalQaTrainerAccount("trainer_456");

    expect(mockConversationFindMany).toHaveBeenCalledWith({
      where: { trainerId: "trainer_456" },
      select: { id: true },
    });
    expect(mockDeferredOfficialChatDeleteMany).toHaveBeenCalledWith({
      where: { conversationId: { in: ["trainer_conv_1"] } },
    });
    expect(mockTrainerClientChatMessageDeleteMany).toHaveBeenCalledWith({
      where: { conversationId: { in: ["trainer_conv_1"] } },
    });
    expect(mockTrainerClientConversationDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["trainer_conv_1"] } },
    });
    expect(mockTrainerProfileUpdateMany).toHaveBeenCalledWith({
      where: { trainerId: "trainer_456" },
      data: expect.objectContaining({
        hasSignedTOS: false,
        hasUploadedW9: false,
        hasPaidBackgroundFee: false,
        backgroundCheckStatus: "NOT_STARTED",
        certificationReviewStatus: "NOT_STARTED",
        dashboardActivatedAt: null,
        serviceOfferingsJson: null,
      }),
    });
    expect(mockTrainerUpdate).toHaveBeenCalledWith({
      where: { id: "trainer_456" },
      data: expect.objectContaining({
        bio: null,
        profileImageUrl: null,
        socialInstagram: null,
        socialLinkedin: null,
      }),
    });
  });

  it("skips trainer conversation deletes when there are no conversations", async () => {
    mockConversationFindMany.mockResolvedValueOnce([]);

    await resetInternalQaTrainerAccount("trainer_no_conversations");

    expect(mockDeferredOfficialChatDeleteMany).not.toHaveBeenCalled();
    expect(mockTrainerClientChatMessageDeleteMany).not.toHaveBeenCalled();
    expect(mockTrainerClientConversationDeleteMany).not.toHaveBeenCalled();
    expect(mockTrainerClientNudgeDeleteMany).toHaveBeenCalledWith({
      where: { trainerId: "trainer_no_conversations" },
    });
    expect(mockTrainerDiscoverMatchBatchDeleteMany).toHaveBeenCalledWith({
      where: { trainerId: "trainer_no_conversations" },
    });
    expect(mockTrainerTwoFactorChannelDeleteMany).toHaveBeenCalledWith({
      where: { trainerId: "trainer_no_conversations" },
    });
  });
});

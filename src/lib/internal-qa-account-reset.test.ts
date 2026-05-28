import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockPrismaTransaction,
  mockConversationFindMany,
  mockDeferredChatDeleteMany,
  mockChatMessageDeleteMany,
  mockConversationDeleteMany,
  mockTrainerClientNudgeDeleteMany,
  mockClientSavedTrainerDeleteMany,
  mockClientTrainerBrowsePassDeleteMany,
  mockWebPushDeleteMany,
  mockClientTwoFactorDeleteMany,
  mockClientUpdate,
} = vi.hoisted(() => ({
  mockPrismaTransaction: vi.fn(),
  mockConversationFindMany: vi.fn(),
  mockDeferredChatDeleteMany: vi.fn(),
  mockChatMessageDeleteMany: vi.fn(),
  mockConversationDeleteMany: vi.fn(),
  mockTrainerClientNudgeDeleteMany: vi.fn(),
  mockClientSavedTrainerDeleteMany: vi.fn(),
  mockClientTrainerBrowsePassDeleteMany: vi.fn(),
  mockWebPushDeleteMany: vi.fn(),
  mockClientTwoFactorDeleteMany: vi.fn(),
  mockClientUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockPrismaTransaction,
  },
}));

import { resetInternalQaClientAccount } from "@/lib/internal-qa-account-reset";

describe("resetInternalQaClientAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationFindMany.mockResolvedValue([]);
    mockDeferredChatDeleteMany.mockResolvedValue({ count: 0 });
    mockChatMessageDeleteMany.mockResolvedValue({ count: 0 });
    mockConversationDeleteMany.mockResolvedValue({ count: 0 });
    mockTrainerClientNudgeDeleteMany.mockResolvedValue({ count: 0 });
    mockClientSavedTrainerDeleteMany.mockResolvedValue({ count: 0 });
    mockClientTrainerBrowsePassDeleteMany.mockResolvedValue({ count: 0 });
    mockWebPushDeleteMany.mockResolvedValue({ count: 0 });
    mockClientTwoFactorDeleteMany.mockResolvedValue({ count: 0 });
    mockClientUpdate.mockResolvedValue({});

    mockPrismaTransaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => Promise<void>) =>
      cb({
        trainerClientConversation: {
          findMany: mockConversationFindMany,
          deleteMany: mockConversationDeleteMany,
        },
        internalQaDeferredOfficialChat: { deleteMany: mockDeferredChatDeleteMany },
        trainerClientChatMessage: { deleteMany: mockChatMessageDeleteMany },
        trainerClientNudge: { deleteMany: mockTrainerClientNudgeDeleteMany },
        clientSavedTrainer: { deleteMany: mockClientSavedTrainerDeleteMany },
        clientTrainerBrowsePass: { deleteMany: mockClientTrainerBrowsePassDeleteMany },
        webPushSubscription: { deleteMany: mockWebPushDeleteMany },
        clientTwoFactorChannel: { deleteMany: mockClientTwoFactorDeleteMany },
        client: { update: mockClientUpdate },
      }),
    );
  });

  it("deletes conversation-scoped data before resetting client onboarding/billing fields", async () => {
    mockConversationFindMany.mockResolvedValueOnce([{ id: "conv_1" }, { id: "conv_2" }]);

    await expect(resetInternalQaClientAccount("client_123")).resolves.toBeUndefined();

    expect(mockDeferredChatDeleteMany).toHaveBeenCalledWith({
      where: { conversationId: { in: ["conv_1", "conv_2"] } },
    });
    expect(mockChatMessageDeleteMany).toHaveBeenCalledWith({
      where: { conversationId: { in: ["conv_1", "conv_2"] } },
    });
    expect(mockConversationDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["conv_1", "conv_2"] } },
    });

    const updateArgs = mockClientUpdate.mock.calls[0]?.[0] as {
      where: { id: string };
      data: {
        stripeCustomerId: null;
        stripeSubscriptionId: null;
        stripeSubscriptionActive: boolean;
        stripeBillingLiveMode: boolean;
        subscriptionGraceUntil: null;
      };
    };
    expect(updateArgs.where.id).toBe("client_123");
    expect(updateArgs.data.stripeCustomerId).toBeNull();
    expect(updateArgs.data.stripeSubscriptionId).toBeNull();
    expect(updateArgs.data.stripeSubscriptionActive).toBe(false);
    expect(updateArgs.data.stripeBillingLiveMode).toBe(false);
    expect(updateArgs.data.subscriptionGraceUntil).toBeNull();
  });

  it("skips conversation deletes when the account has no conversations", async () => {
    mockConversationFindMany.mockResolvedValueOnce([]);

    await expect(resetInternalQaClientAccount("client_no_convos")).resolves.toBeUndefined();

    expect(mockDeferredChatDeleteMany).not.toHaveBeenCalled();
    expect(mockChatMessageDeleteMany).not.toHaveBeenCalled();
    expect(mockConversationDeleteMany).not.toHaveBeenCalled();
    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
  });
});

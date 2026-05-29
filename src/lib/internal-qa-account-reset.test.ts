import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

import { resetInternalQaClientAccount, resetInternalQaTrainerAccount } from "@/lib/internal-qa-account-reset";

function createTxMocks() {
  return {
    trainerClientConversation: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    internalQaDeferredOfficialChat: {
      deleteMany: vi.fn(),
    },
    trainerClientChatMessage: {
      deleteMany: vi.fn(),
    },
    trainerClientNudge: {
      deleteMany: vi.fn(),
    },
    clientSavedTrainer: {
      deleteMany: vi.fn(),
    },
    clientTrainerBrowsePass: {
      deleteMany: vi.fn(),
    },
    webPushSubscription: {
      deleteMany: vi.fn(),
    },
    clientTwoFactorChannel: {
      deleteMany: vi.fn(),
    },
    client: {
      update: vi.fn(),
    },
    trainerDiscoverMatchBatch: {
      deleteMany: vi.fn(),
    },
    trainerTwoFactorChannel: {
      deleteMany: vi.fn(),
    },
    trainerProfile: {
      updateMany: vi.fn(),
    },
    trainer: {
      update: vi.fn(),
    },
  };
}

describe("internal-qa-account-reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets client account data, including new billing mode fields", async () => {
    const tx = createTxMocks();
    tx.trainerClientConversation.findMany.mockResolvedValueOnce([{ id: "conv_1" }, { id: "conv_2" }]);
    mockTransaction.mockImplementationOnce(async (callback: (value: typeof tx) => Promise<void>) => callback(tx));

    await resetInternalQaClientAccount("client_1");

    expect(tx.internalQaDeferredOfficialChat.deleteMany).toHaveBeenCalledWith({
      where: { conversationId: { in: ["conv_1", "conv_2"] } },
    });
    expect(tx.trainerClientChatMessage.deleteMany).toHaveBeenCalledWith({
      where: { conversationId: { in: ["conv_1", "conv_2"] } },
    });
    expect(tx.trainerClientConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["conv_1", "conv_2"] } },
    });
    expect(tx.client.update).toHaveBeenCalledWith({
      where: { id: "client_1" },
      data: expect.objectContaining({
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeSubscriptionActive: false,
        stripeBillingLiveMode: false,
        subscriptionGraceUntil: null,
        stripeLastSubscriptionInvoicePaidAt: null,
      }),
    });
  });

  it("skips conversation cleanup for client reset when no conversations exist", async () => {
    const tx = createTxMocks();
    tx.trainerClientConversation.findMany.mockResolvedValueOnce([]);
    mockTransaction.mockImplementationOnce(async (callback: (value: typeof tx) => Promise<void>) => callback(tx));

    await resetInternalQaClientAccount("client_2");

    expect(tx.internalQaDeferredOfficialChat.deleteMany).not.toHaveBeenCalled();
    expect(tx.trainerClientChatMessage.deleteMany).not.toHaveBeenCalled();
    expect(tx.trainerClientConversation.deleteMany).not.toHaveBeenCalled();
    expect(tx.client.update).toHaveBeenCalledTimes(1);
  });

  it("resets trainer profile and trainer fields during trainer reset", async () => {
    const tx = createTxMocks();
    tx.trainerClientConversation.findMany.mockResolvedValueOnce([{ id: "conv_trainer_1" }]);
    mockTransaction.mockImplementationOnce(async (callback: (value: typeof tx) => Promise<void>) => callback(tx));

    await resetInternalQaTrainerAccount("trainer_1");

    expect(tx.trainerClientConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["conv_trainer_1"] } },
    });
    expect(tx.trainerProfile.updateMany).toHaveBeenCalledWith({
      where: { trainerId: "trainer_1" },
      data: expect.objectContaining({
        hasSignedTOS: false,
        hasUploadedW9: false,
        hasPaidBackgroundFee: false,
        backgroundCheckStatus: "NOT_STARTED",
        dashboardActivatedAt: null,
      }),
    });
    expect(tx.trainer.update).toHaveBeenCalledWith({
      where: { id: "trainer_1" },
      data: expect.objectContaining({
        bio: null,
        profileImageUrl: null,
        socialInstagram: null,
      }),
    });
  });
});

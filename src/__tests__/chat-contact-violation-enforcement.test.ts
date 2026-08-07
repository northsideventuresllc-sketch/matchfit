import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    suspensionRecord: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    trainer: {
      update: vi.fn(),
    },
    trainerNotification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { applyTrainerMarketplaceSuspensionSideEffectsMock, notifyClientsTrainerSuspensionLiftedMock } = vi.hoisted(
  () => ({
    applyTrainerMarketplaceSuspensionSideEffectsMock: vi.fn().mockResolvedValue({
      bookingsCancelled: 0,
      refundsAttempted: 0,
      clientsNotified: 0,
    }),
    notifyClientsTrainerSuspensionLiftedMock: vi.fn().mockResolvedValue(0),
  }),
);

vi.mock("@/lib/trainer-suspension-marketplace", () => ({
  applyTrainerMarketplaceSuspensionSideEffects: applyTrainerMarketplaceSuspensionSideEffectsMock,
  notifyClientsTrainerSuspensionLifted: notifyClientsTrainerSuspensionLiftedMock,
}));

import {
  CHAT_CONTACT_TEMP_BAN_DAYS,
  CHAT_CONTACT_VIOLATION_REASON,
  liftExpiredChatContactTempBans,
  recordChatContactViolationAndSuspendTrainer,
} from "@/lib/chat-contact-violation-enforcement";

describe("recordChatContactViolationAndSuspendTrainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("first substantiated violation applies a temporary suspension", async () => {
    prismaMock.suspensionRecord.count.mockResolvedValue(0);

    const outcome = await recordChatContactViolationAndSuspendTrainer("trainer_1");

    expect(outcome.tier).toBe("temporary");
    expect(prismaMock.trainer.update).toHaveBeenCalledWith({
      where: { id: "trainer_1" },
      data: { safetySuspended: true, safetySuspendedAt: new Date("2026-08-07T12:00:00.000Z") },
    });
    const createCall = prismaMock.suspensionRecord.create.mock.calls[0]![0];
    expect(createCall.data.reason).toBe(CHAT_CONTACT_VIOLATION_REASON);
    expect(createCall.data.subjectIsTrainer).toBe(true);
    expect(createCall.data.subjectId).toBe("trainer_1");
    const expectedExpiry = new Date("2026-08-07T12:00:00.000Z");
    expectedExpiry.setUTCDate(expectedExpiry.getUTCDate() + CHAT_CONTACT_TEMP_BAN_DAYS);
    expect(createCall.data.expiresAt).toEqual(expectedExpiry);
    expect(applyTrainerMarketplaceSuspensionSideEffectsMock).toHaveBeenCalledWith({
      trainerId: "trainer_1",
      reasonCode: "CHAT_CONTACT_LEAKAGE",
    });
  });

  it("second substantiated violation is permanent (no expiry)", async () => {
    prismaMock.suspensionRecord.count.mockResolvedValue(1);

    const outcome = await recordChatContactViolationAndSuspendTrainer("trainer_2");

    expect(outcome).toEqual({ tier: "permanent" });
    const createCall = prismaMock.suspensionRecord.create.mock.calls[0]![0];
    expect(createCall.data.expiresAt).toBeNull();
  });
});

describe("liftExpiredChatContactTempBans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores a trainer once their only open suspension record expires", async () => {
    prismaMock.suspensionRecord.findMany.mockResolvedValue([{ id: "sr_1", subjectId: "trainer_1" }]);
    prismaMock.suspensionRecord.findFirst.mockResolvedValue(null); // no other open suspension

    const lifted = await liftExpiredChatContactTempBans(new Date("2026-11-05T12:00:00.000Z"));

    expect(lifted).toBe(1);
    expect(prismaMock.suspensionRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sr_1" } }),
    );
    expect(prismaMock.trainer.update).toHaveBeenCalledWith({
      where: { id: "trainer_1" },
      data: { safetySuspended: false, safetySuspendedAt: null },
    });
    expect(notifyClientsTrainerSuspensionLiftedMock).toHaveBeenCalledWith("trainer_1");
  });

  it("leaves the trainer suspended if another open suspension record remains", async () => {
    prismaMock.suspensionRecord.findMany.mockResolvedValue([{ id: "sr_1", subjectId: "trainer_1" }]);
    prismaMock.suspensionRecord.findFirst.mockResolvedValue({ id: "sr_other" }); // still has an open one

    const lifted = await liftExpiredChatContactTempBans(new Date("2026-11-05T12:00:00.000Z"));

    expect(lifted).toBe(1);
    expect(prismaMock.trainer.update).not.toHaveBeenCalled();
    expect(notifyClientsTrainerSuspensionLiftedMock).not.toHaveBeenCalled();
  });
});

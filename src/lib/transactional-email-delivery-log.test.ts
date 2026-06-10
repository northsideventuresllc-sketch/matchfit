import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDeliveryCreate, mockDeliveryGroupBy, mockDeliveryFindMany } = vi.hoisted(() => ({
  mockDeliveryCreate: vi.fn(),
  mockDeliveryGroupBy: vi.fn(),
  mockDeliveryFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transactionalEmailDelivery: {
      create: mockDeliveryCreate,
      groupBy: mockDeliveryGroupBy,
      findMany: mockDeliveryFindMany,
    },
  },
}));

import { getAdminEmailStatsPanel, logTransactionalEmailDelivery } from "@/lib/transactional-email-delivery-log";

describe("transactional-email-delivery-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeliveryCreate.mockResolvedValue(undefined);
    mockDeliveryGroupBy.mockResolvedValue([]);
    mockDeliveryFindMany.mockResolvedValue([]);
  });

  it("persists transactional email delivery rows", async () => {
    await logTransactionalEmailDelivery({
      kind: "CLIENT_WELCOME",
      audience: "CLIENT",
      toEmail: "client@example.com",
      subject: "Welcome",
      status: "sent",
      resendId: "re_123",
      clientId: "client_1",
    });

    expect(mockDeliveryCreate).toHaveBeenCalledWith({
      data: {
        kind: "CLIENT_WELCOME",
        audience: "CLIENT",
        toEmail: "client@example.com",
        subject: "Welcome",
        status: "sent",
        resendId: "re_123",
        errorMessage: null,
        clientId: "client_1",
        trainerId: null,
      },
    });
  });

  it("swallows delivery log write errors after warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockDeliveryCreate.mockRejectedValueOnce(new Error("insert failed"));

    await expect(
      logTransactionalEmailDelivery({
        kind: "PASSWORD_RESET",
        audience: "CLIENT",
        toEmail: "client@example.com",
        subject: "Reset",
        status: "failed",
        errorMessage: "smtp timeout",
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("builds admin email stats with grouped totals and recent rows", async () => {
    mockDeliveryGroupBy.mockResolvedValueOnce([
      { status: "sent", kind: "CLIENT_WELCOME", _count: { _all: 3 } },
      { status: "failed", kind: "CLIENT_WELCOME", _count: { _all: 1 } },
      { status: "sent", kind: "TRAINER_WELCOME", _count: { _all: 2 } },
      { status: "skipped_prefs", kind: "CLIENT_WELCOME", _count: { _all: 4 } },
      { status: "skipped_no_recipient", kind: "PASSWORD_RESET", _count: { _all: 1 } },
    ]);
    mockDeliveryFindMany.mockResolvedValueOnce([
      {
        id: "log_1",
        createdAt: new Date("2026-06-09T10:00:00.000Z"),
        kind: "CLIENT_WELCOME",
        toEmail: "client@example.com",
        status: "sent",
        subject: "Welcome",
      },
    ]);

    const result = await getAdminEmailStatsPanel(14);

    expect(mockDeliveryGroupBy).toHaveBeenCalledWith({
      by: ["status", "kind"],
      where: { createdAt: { gte: expect.any(Date) } },
      _count: { _all: true },
    });
    expect(mockDeliveryFindMany).toHaveBeenCalledWith({
      where: { createdAt: { gte: expect.any(Date) } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        createdAt: true,
        kind: true,
        toEmail: true,
        status: true,
        subject: true,
      },
    });

    expect(result).toEqual({
      windowDays: 14,
      totalAttempts: 11,
      sent: 5,
      skippedPrefs: 4,
      skippedNoRecipient: 1,
      failed: 1,
      byKind: [
        { kind: "CLIENT_WELCOME", sent: 3, failed: 1 },
        { kind: "TRAINER_WELCOME", sent: 2, failed: 0 },
        { kind: "PASSWORD_RESET", sent: 0, failed: 0 },
      ],
      recent: [
        {
          id: "log_1",
          at: "2026-06-09T10:00:00.000Z",
          kind: "CLIENT_WELCOME",
          toEmail: "client@example.com",
          status: "sent",
          subject: "Welcome",
        },
      ],
    });
  });
});

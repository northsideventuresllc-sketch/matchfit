import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSupportInboxFindMany,
  mockSupportInboxUpdate,
  mockSupportInboxUpsert,
  mockSupportInboxCreate,
  mockIsPrismaMissingTableError,
} = vi.hoisted(() => ({
  mockSupportInboxFindMany: vi.fn(),
  mockSupportInboxUpdate: vi.fn(),
  mockSupportInboxUpsert: vi.fn(),
  mockSupportInboxCreate: vi.fn(),
  mockIsPrismaMissingTableError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportInboxMessage: {
      findMany: mockSupportInboxFindMany,
      update: mockSupportInboxUpdate,
      upsert: mockSupportInboxUpsert,
      create: mockSupportInboxCreate,
    },
  },
}));

vi.mock("@/lib/prisma-missing-column", () => ({
  isPrismaMissingTableError: mockIsPrismaMissingTableError,
}));

import {
  listSupportInboxMessages,
  markSupportMessageRead,
  storeSupportInboxMessage,
} from "@/lib/support-inbox-data";

describe("support-inbox-data helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupportInboxFindMany.mockResolvedValue([]);
    mockSupportInboxUpdate.mockResolvedValue(undefined);
    mockSupportInboxUpsert.mockResolvedValue(undefined);
    mockSupportInboxCreate.mockResolvedValue(undefined);
    mockIsPrismaMissingTableError.mockReturnValue(false);
  });

  it("maps inbox rows into API-ready shape", async () => {
    mockSupportInboxFindMany.mockResolvedValueOnce([
      {
        id: "msg_1",
        createdAt: new Date("2026-06-09T00:00:00.000Z"),
        fromEmail: "person@example.com",
        subject: "Question",
        textBody: "a".repeat(300),
        status: "unread",
      },
    ]);

    await expect(listSupportInboxMessages(25)).resolves.toEqual([
      {
        id: "msg_1",
        createdAt: "2026-06-09T00:00:00.000Z",
        fromEmail: "person@example.com",
        subject: "Question",
        textPreview: "a".repeat(240),
        status: "unread",
      },
    ]);

    expect(mockSupportInboxFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        createdAt: true,
        fromEmail: true,
        subject: true,
        textBody: true,
        status: true,
      },
    });
  });

  it("returns an empty list when support table is missing", async () => {
    const err = new Error("missing support inbox table");
    mockSupportInboxFindMany.mockRejectedValueOnce(err);
    mockIsPrismaMissingTableError.mockReturnValueOnce(true);

    await expect(listSupportInboxMessages()).resolves.toEqual([]);
    expect(mockIsPrismaMissingTableError).toHaveBeenCalledWith(err, "support_inbox_messages");
  });

  it("rethrows unknown support inbox query failures", async () => {
    const err = new Error("db unavailable");
    mockSupportInboxFindMany.mockRejectedValueOnce(err);
    mockIsPrismaMissingTableError.mockReturnValueOnce(false);

    await expect(listSupportInboxMessages()).rejects.toBe(err);
  });

  it("marks a support message as read", async () => {
    await markSupportMessageRead("msg_42");

    expect(mockSupportInboxUpdate).toHaveBeenCalledWith({
      where: { id: "msg_42" },
      data: { status: "read" },
    });
  });

  it("upserts support messages when resend email id exists", async () => {
    await storeSupportInboxMessage({
      resendEmailId: "email_abc",
      fromEmail: "sender@example.com",
      toEmail: "support@match-fit.net",
      subject: "Need help",
      textBody: "hello",
      htmlBody: "<p>hello</p>",
    });

    expect(mockSupportInboxUpsert).toHaveBeenCalledWith({
      where: { resendEmailId: "email_abc" },
      create: {
        resendEmailId: "email_abc",
        fromEmail: "sender@example.com",
        toEmail: "support@match-fit.net",
        subject: "Need help",
        textBody: "hello",
        htmlBody: "<p>hello</p>",
        status: "unread",
      },
      update: {
        fromEmail: "sender@example.com",
        toEmail: "support@match-fit.net",
        subject: "Need help",
        textBody: "hello",
        htmlBody: "<p>hello</p>",
        status: "unread",
      },
    });
    expect(mockSupportInboxCreate).not.toHaveBeenCalled();
  });

  it("creates support messages when resend email id is missing", async () => {
    await storeSupportInboxMessage({
      fromEmail: "sender@example.com",
      toEmail: "support@match-fit.net",
      subject: "No resend id",
      textBody: null,
    });

    expect(mockSupportInboxCreate).toHaveBeenCalledWith({
      data: {
        fromEmail: "sender@example.com",
        toEmail: "support@match-fit.net",
        subject: "No resend id",
        textBody: null,
        htmlBody: null,
        status: "unread",
      },
    });
    expect(mockSupportInboxUpsert).not.toHaveBeenCalled();
  });

  it("swallows persistence failures while warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockSupportInboxCreate.mockRejectedValueOnce(new Error("write failed"));

    await expect(
      storeSupportInboxMessage({
        fromEmail: "sender@example.com",
        toEmail: "support@match-fit.net",
        subject: "Failure path",
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

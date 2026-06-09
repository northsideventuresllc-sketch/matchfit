import { beforeEach, describe, expect, it, vi } from "vitest";
import { MATCH_FIT_REPLY_TO } from "@/lib/resend-client";

const {
  clientFindUniqueMock,
  trainerFindUniqueMock,
  parseClientNotificationPrefsJsonMock,
  parseTrainerNotificationPrefsJsonMock,
  clientAllowsTransactionalEmailKindMock,
  trainerAllowsTransactionalEmailKindMock,
  sendMatchFitBrandedEmailMock,
  buildTransactionalEmailMock,
  isMandatoryTransactionalEmailKindMock,
  logTransactionalEmailDeliveryMock,
} = vi.hoisted(() => ({
  clientFindUniqueMock: vi.fn(),
  trainerFindUniqueMock: vi.fn(),
  parseClientNotificationPrefsJsonMock: vi.fn(),
  parseTrainerNotificationPrefsJsonMock: vi.fn(),
  clientAllowsTransactionalEmailKindMock: vi.fn(),
  trainerAllowsTransactionalEmailKindMock: vi.fn(),
  sendMatchFitBrandedEmailMock: vi.fn(),
  buildTransactionalEmailMock: vi.fn(),
  isMandatoryTransactionalEmailKindMock: vi.fn(),
  logTransactionalEmailDeliveryMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: clientFindUniqueMock,
    },
    trainer: {
      findUnique: trainerFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/client-notification-prefs", () => ({
  parseClientNotificationPrefsJson: parseClientNotificationPrefsJsonMock,
}));

vi.mock("@/lib/trainer-notification-prefs", () => ({
  parseTrainerNotificationPrefsJson: parseTrainerNotificationPrefsJsonMock,
}));

vi.mock("@/lib/match-fit-branded-email", () => ({
  sendMatchFitBrandedEmail: sendMatchFitBrandedEmailMock,
}));

vi.mock("@/lib/transactional-email-templates", () => ({
  buildTransactionalEmail: buildTransactionalEmailMock,
}));

vi.mock("@/lib/transactional-email-kinds", () => ({
  isMandatoryTransactionalEmailKind: isMandatoryTransactionalEmailKindMock,
}));

vi.mock("@/lib/transactional-email-prefs", () => ({
  clientAllowsTransactionalEmailKind: clientAllowsTransactionalEmailKindMock,
  trainerAllowsTransactionalEmailKind: trainerAllowsTransactionalEmailKindMock,
}));

vi.mock("@/lib/transactional-email-delivery-log", () => ({
  logTransactionalEmailDelivery: logTransactionalEmailDeliveryMock,
}));

import { sendTransactionalEmailIfAllowed } from "@/lib/transactional-email-send";

describe("sendTransactionalEmailIfAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMandatoryTransactionalEmailKindMock.mockReturnValue(false);
    buildTransactionalEmailMock.mockReturnValue({
      subject: "Subject line",
      text: "Text body",
      html: "<p>Html body</p>",
    });
    parseClientNotificationPrefsJsonMock.mockReturnValue({});
    parseTrainerNotificationPrefsJsonMock.mockReturnValue({});
    clientAllowsTransactionalEmailKindMock.mockReturnValue(true);
    trainerAllowsTransactionalEmailKindMock.mockReturnValue(true);
    clientFindUniqueMock.mockResolvedValue(null);
    trainerFindUniqueMock.mockResolvedValue(null);
    sendMatchFitBrandedEmailMock.mockResolvedValue("msg_1");
    logTransactionalEmailDeliveryMock.mockResolvedValue(undefined);
  });

  it("skips when recipient is empty", async () => {
    const result = await sendTransactionalEmailIfAllowed({
      kind: "CLIENT_WELCOME",
      to: "   ",
      audience: "CLIENT",
      variables: {},
    });

    expect(result).toEqual({ sent: false, skipped: "no_recipient" });
    expect(sendMatchFitBrandedEmailMock).not.toHaveBeenCalled();
    expect(logTransactionalEmailDeliveryMock).toHaveBeenCalledWith({
      kind: "CLIENT_WELCOME",
      audience: "CLIENT",
      toEmail: "",
      subject: "Subject line",
      status: "skipped_no_recipient",
      clientId: undefined,
      trainerId: undefined,
    });
  });

  it("skips optional client emails when notification prefs disallow", async () => {
    clientFindUniqueMock.mockResolvedValue({ notificationPrefsJson: { email: { clientWelcome: false } } });
    parseClientNotificationPrefsJsonMock.mockReturnValue({ email: { clientWelcome: false } });
    clientAllowsTransactionalEmailKindMock.mockReturnValue(false);

    const result = await sendTransactionalEmailIfAllowed({
      kind: "CLIENT_WELCOME",
      to: "client@example.com",
      audience: "CLIENT",
      clientId: "client_123",
      variables: {},
    });

    expect(clientFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "client_123" },
      select: { notificationPrefsJson: true },
    });
    expect(result).toEqual({ sent: false, skipped: "prefs" });
    expect(sendMatchFitBrandedEmailMock).not.toHaveBeenCalled();
    expect(logTransactionalEmailDeliveryMock).toHaveBeenCalledWith({
      kind: "CLIENT_WELCOME",
      audience: "CLIENT",
      toEmail: "client@example.com",
      subject: "Subject line",
      status: "skipped_prefs",
      clientId: "client_123",
      trainerId: undefined,
    });
  });

  it("skips optional trainer emails when notification prefs disallow", async () => {
    trainerFindUniqueMock.mockResolvedValue({ notificationPrefsJson: { email: { trainerWelcome: false } } });
    parseTrainerNotificationPrefsJsonMock.mockReturnValue({ email: { trainerWelcome: false } });
    trainerAllowsTransactionalEmailKindMock.mockReturnValue(false);

    const result = await sendTransactionalEmailIfAllowed({
      kind: "TRAINER_WELCOME",
      to: "trainer@example.com",
      audience: "TRAINER",
      trainerId: "trainer_123",
      variables: {},
    });

    expect(trainerFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "trainer_123" },
      select: { notificationPrefsJson: true },
    });
    expect(result).toEqual({ sent: false, skipped: "prefs" });
    expect(sendMatchFitBrandedEmailMock).not.toHaveBeenCalled();
    expect(logTransactionalEmailDeliveryMock).toHaveBeenCalledWith({
      kind: "TRAINER_WELCOME",
      audience: "TRAINER",
      toEmail: "trainer@example.com",
      subject: "Subject line",
      status: "skipped_prefs",
      clientId: undefined,
      trainerId: "trainer_123",
    });
  });

  it("sends with support reply-to for non-staff audiences", async () => {
    const result = await sendTransactionalEmailIfAllowed({
      kind: "PASSWORD_RESET",
      to: "  member@example.com  ",
      audience: "CLIENT",
      variables: { resetUrl: "https://example.test/reset" },
    });

    expect(result).toEqual({ sent: true });
    expect(buildTransactionalEmailMock).toHaveBeenCalledWith("PASSWORD_RESET", {
      resetUrl: "https://example.test/reset",
    });
    expect(sendMatchFitBrandedEmailMock).toHaveBeenCalledWith({
      to: "member@example.com",
      subject: "Subject line",
      text: "Text body",
      html: "<p>Html body</p>",
      replyTo: MATCH_FIT_REPLY_TO,
    });
    expect(logTransactionalEmailDeliveryMock).toHaveBeenCalledWith({
      kind: "PASSWORD_RESET",
      audience: "CLIENT",
      toEmail: "member@example.com",
      subject: "Subject line",
      status: "sent",
      resendId: "msg_1",
      clientId: undefined,
      trainerId: undefined,
    });
  });

  it("omits reply-to for staff audience", async () => {
    const result = await sendTransactionalEmailIfAllowed({
      kind: "BUG_REPORT_ACKNOWLEDGMENT",
      to: "staff@example.com",
      audience: "STAFF",
      variables: { ticketId: "42" },
    });

    expect(result).toEqual({ sent: true });
    expect(clientFindUniqueMock).not.toHaveBeenCalled();
    expect(trainerFindUniqueMock).not.toHaveBeenCalled();
    expect(sendMatchFitBrandedEmailMock).toHaveBeenCalledWith({
      to: "staff@example.com",
      subject: "Subject line",
      text: "Text body",
      html: "<p>Html body</p>",
      replyTo: undefined,
    });
    expect(logTransactionalEmailDeliveryMock).toHaveBeenCalledWith({
      kind: "BUG_REPORT_ACKNOWLEDGMENT",
      audience: "STAFF",
      toEmail: "staff@example.com",
      subject: "Subject line",
      status: "sent",
      resendId: "msg_1",
      clientId: undefined,
      trainerId: undefined,
    });
  });

  it("bypasses preference lookups for mandatory kinds", async () => {
    isMandatoryTransactionalEmailKindMock.mockReturnValue(true);

    const result = await sendTransactionalEmailIfAllowed({
      kind: "PASSWORD_RESET",
      to: "secure@example.com",
      audience: "CLIENT",
      clientId: "client_123",
      variables: { resetUrl: "https://example.test/reset" },
    });

    expect(result).toEqual({ sent: true });
    expect(clientFindUniqueMock).not.toHaveBeenCalled();
    expect(trainerFindUniqueMock).not.toHaveBeenCalled();
    expect(sendMatchFitBrandedEmailMock).toHaveBeenCalled();
  });

  it("logs failed status and rethrows when delivery fails", async () => {
    sendMatchFitBrandedEmailMock.mockRejectedValueOnce(new Error("resend down"));

    await expect(
      sendTransactionalEmailIfAllowed({
        kind: "PASSWORD_RESET",
        to: "member@example.com",
        audience: "CLIENT",
        variables: { resetUrl: "https://example.test/reset" },
      }),
    ).rejects.toThrow("resend down");

    expect(logTransactionalEmailDeliveryMock).toHaveBeenCalledWith({
      kind: "PASSWORD_RESET",
      audience: "CLIENT",
      toEmail: "member@example.com",
      subject: "Subject line",
      status: "failed",
      errorMessage: "resend down",
      clientId: undefined,
      trainerId: undefined,
    });
  });
});

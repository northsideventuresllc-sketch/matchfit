import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStoreSupportInboxMessage = vi.fn();
const mockReceivingGet = vi.fn();

vi.mock("@/lib/support-inbox-data", () => ({
  storeSupportInboxMessage: (...args: unknown[]) => mockStoreSupportInboxMessage(...args),
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/platform-secrets", () => ({
  readPlatformSecret: vi.fn().mockResolvedValue("re_test_key"),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      receiving: {
        get: (...args: unknown[]) => mockReceivingGet(...args),
      },
    },
  })),
}));

import { POST } from "@/app/api/webhooks/resend-inbound/route";
import { processResendInboundWebhook } from "@/lib/resend-inbound-webhook";

describe("POST /api/webhooks/resend-inbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReceivingGet.mockResolvedValue({
      data: {
        text: "Hello support team",
        html: "<p>Hello support team</p>",
      },
      error: null,
    });
  });

  it("stores support@match-fit.net inbound email.received events", async () => {
    const body = JSON.stringify({
      type: "email.received",
      data: {
        email_id: "email_abc123",
        from: "user@example.com",
        to: ["support@match-fit.net"],
        subject: "Need help",
      },
    });

    const res = await POST(
      new Request("https://match-fit.net/api/webhooks/resend-inbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": "msg_test",
          "svix-timestamp": "1710000000",
          "svix-signature": "v1,test",
        },
        body,
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stored: true });
    expect(mockReceivingGet).toHaveBeenCalledWith("email_abc123");
    expect(mockStoreSupportInboxMessage).toHaveBeenCalledWith({
      resendEmailId: "email_abc123",
      fromEmail: "user@example.com",
      toEmail: "support@match-fit.net",
      subject: "Need help",
      textBody: "Hello support team",
      htmlBody: "<p>Hello support team</p>",
    });
  });

  it("skips non-support recipients", async () => {
    const body = JSON.stringify({
      type: "email.received",
      data: {
        email_id: "email_other",
        from: "user@example.com",
        to: ["other@example.com"],
        subject: "Other",
      },
    });

    const res = await POST(
      new Request("https://match-fit.net/api/webhooks/resend-inbound", {
        method: "POST",
        body,
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stored: false, skipped: "not_support_address" });
    expect(mockStoreSupportInboxMessage).not.toHaveBeenCalled();
  });
});

describe("processResendInboundWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReceivingGet.mockResolvedValue({ data: null, error: null });
  });

  it("ignores non email.received payloads", async () => {
    const result = await processResendInboundWebhook(JSON.stringify({ type: "email.delivered" }));
    expect(result).toEqual({ stored: false, skipped: "not_email_received" });
  });
});
